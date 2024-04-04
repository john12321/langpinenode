import fs from "fs";
import util from "util";
import path from "path";
import { Pinecone } from "@pinecone-database/pinecone";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import * as dotenv from "dotenv";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";

dotenv.config();
const question = "When do I have to submit a Form R?";
const writeFile = util.promisify(fs.writeFile);
const indexName = "gold-guide-9";
const gg9EmbeddingsLocation = "embeddings/gg9.json";
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});
const pcIndex = pinecone.Index(indexName);

const createPineconeIndex = async () => {
  try {
    const pineconeIndexes = await pinecone.listIndexes();
    if (pineconeIndexes.length > 0) {
      console.log(`Pinecone index ${pineconeIndexes[0].name} already exists`);
      return;
    }
    console.log("Creating Pinecone index...");
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536,
      metric: "cosine",
    });
    console.log("Pinecone index created. Waiting 60s for index to be ready...");
    await new Promise(resolve => setTimeout(resolve, 60000));
  } catch (error) {
    console.error("Error creating Pinecone index: ", error);
  }
};

const loadDocuments = async () => {
  try {
    console.log("Loading documents...");
    const loader = new DirectoryLoader("./documents", {
      ".pdf": path => new PDFLoader(path),
    });
    const loadedDocs = await loader.load();
    console.log(`${loadedDocs.length} documents loaded successfully.`);
    return loadedDocs;
  } catch (error) {
    console.error("Error loading documents: ", error);
  }
};

const createChunks = async loadedDocs => {
  try {
    console.log("Creating chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });
    const chunks = [];
    for (let i = 0; i < loadedDocs.length; i++) {
      const cleanedDoc = loadedDocs[i].pageContent.replace(/\n/g, "");
      const docChunks = await splitter.createDocuments([cleanedDoc]);
      docChunks.forEach(chunk => {
        chunk.metadata.source = `Page: ${i + 1}`; // add page number to source
        chunks.push(chunk);
      });
    }
    console.log(`${chunks.length} chunks created successfully.`);
    return chunks;
  } catch (error) {
    console.error("Error creating chunks: ", error);
  }
};

const createEmbeddings = async chunks => {
  try {
    // Check if embeddings file already exists - to save some cash
    if (fs.existsSync(gg9EmbeddingsLocation)) {
      console.log("Embeddings file already exists so no need to create them.");
      return;
    }
    console.log(
      "Local embeddings file doesn't exist so creating embeddings..."
    );
    const embeddingsModel = new OpenAIEmbeddings();
    const texts = chunks.map(chunk => chunk.pageContent);
    const embeddings = await embeddingsModel.embedDocuments(texts);
    console.log(`${embeddings.length} embeddings created successfully.`);

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(gg9EmbeddingsLocation), { recursive: true });

    // Save embeddings to a file
    await writeFile(gg9EmbeddingsLocation, JSON.stringify(embeddings));
    console.log("Embeddings saved to /embeddings/gg9.json");
    return embeddings;
  } catch (error) {
    console.error("Error creating embeddings: ", error);
  }
};

const updatePineconeIndex = async chunks => {
  try {
    console.log("Reading data from embeddings file...");
    const embeddings = JSON.parse(
      fs.readFileSync(gg9EmbeddingsLocation, "utf8")
    );
    console.log("Successfully read embeddings from file");

    console.log("Updating Pinecone index...");
    const batchSize = 100;
    let count = 1;
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batchEmbeddings = embeddings.slice(i, i + batchSize);
      const batchChunks = chunks.slice(i, i + batchSize);

      const batch = batchChunks.map((chunk, j) => ({
        id: `batch${i}-chunk${j}`,
        values: batchEmbeddings[j],
        metadata: {
          ...chunk.metadata,
          loc: JSON.stringify(chunk.metadata.loc),
          pageContent: chunk.pageContent,
          source: chunk.metadata.source,
        },
      }));
      console.log(
        `Upserting batch ${count} of ${Math.ceil(
          embeddings.length / batchSize
        )}...`
      );
      await pcIndex.upsert(batch);
      count++;
    }
    console.log(`Pinecone index updated with ${chunks.length} vectors`);
  } catch (error) {
    console.error("Error updating Pinecone index: ", error);
  }
};

const deleteThisIndex = async () => {
  try {
    await pinecone.deleteIndex(indexName);
    // delete the embeddings file
    fs.unlinkSync(gg9EmbeddingsLocation);
    console.log("Pinecone index and embeddings file deleted");
  } catch (error) {
    console.log("Error deleting Pinecone index and embeddings file: ", error);
  }
};

const queryPineconeThenGPT3 = async () => {
  try {
    // Start query process
    console.log("Querying Pinecone vector store...");
    // Create query embedding from question
    const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question);
    // Query Pinecone with the embedding and return the top 5 results
    const queryResponse = await pcIndex.query({
      topK: 5,
      vector: queryEmbedding,
      includeValues: true,
      includeMetadata: true,
    });
    console.log("Pinecone results to the question: ", queryResponse);
    // console log queryResponse matches length
    console.log(`Pinecone returned ${queryResponse.matches.length} matches.`);
    // console log the top result
    console.log("Top result from Pinecone: ", queryResponse.matches[0]);
    // console log the top result's metadata
    console.log(
      "Top result's metadata from Pinecone: ",
      queryResponse.matches[0].metadata
    );

    // Query GPT-3 with the question only if there are pinecone matches to the question
    if (queryResponse.matches.length > 0) {
      console.log(`Now querying GPT-3 with question... : ${question}`);
      // Create the GPT-3 query
      const llm = new ChatOpenAI();
      const chain = loadQAStuffChain(llm);
      // Extract and concatenate page content from matched documents
      const concatenatedPageContent = queryResponse.matches
        .map(match => match.metadata.pageContent)
        .join(" ");
      // 11. Execute the chain with input documents and question
      const result = await chain.call({
        input_documents: [
          new Document({ pageContent: concatenatedPageContent }),
        ],
        question: question,
      });
      // 12. Log the answer
      console.log(`Answer: ${result.text}`);
    } else console.log("No matches from Pinecone so not querying GPT-3.");
  } catch (error) {
    console.log("Error querying Pinecone and GPT-3: ", error);
  }
};

(async () => {
  await createPineconeIndex();
  const loadedDocs = await loadDocuments();
  const chunks = await createChunks(loadedDocs);
  const embeddings = await createEmbeddings(chunks);
  await updatePineconeIndex(chunks, embeddings);
  // console.log("Uncomment this next line to delete the index");
  // await deleteThisIndex();
  await queryPineconeThenGPT3();
})();
