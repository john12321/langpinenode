# Chat with your PDF (Node.js)

A very rough demo showing how you can use an LLM to ask questions of a PDF document of your choice.

## Set-up

You will need to add the following to the .env file:

```
OPENAI_API_KEY=yourApiKey
PINECONE_API_KEY=yourApiKey
PINECONE_ENVIRONMENT=yourEnvName e.g. gcp-starter
```

NOTE: you can use alternatives to OpenAI and Pinecone

On the first run you may want to keep the main function `main.js (line 208)` looking like this so you run through all the steps:

```
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
```

But after a successful first run which creates the index, chunks and embeddings, it is probably best to comment out all but the `queryPineconeThenGPT3()` function.

The following lines in `main.js (lines 16-20)` also need editing to your particular set-up:

```
const question = "When do I have to submit a Form R?";
```

```
const indexName = "gold-guide-9"; // I named this index via the Pinecone UI
```

```
const gg9EmbeddingsLocation = "embeddings/gg9.json";
```

## Running the app

`node main` will run the main function.

The result should be a sensible answer to your question in the console!

e.g.

```
Querying Pinecone vector store...
Pinecone results to the question:  {
  matches: [
    {
      id: 'batch300-chunk5',
      score: 0.82536006,
      values: [Array],
      sparseValues: undefined,
      metadata: [Object]
    },
    {
      id: 'batch300-chunk4',
      score: 0.816575,
      values: [Array],
      sparseValues: undefined,
      metadata: [Object]
    },
    {
      id: 'batch100-chunk2',
      score: 0.810189,
      values: [Array],
      sparseValues: undefined,
      metadata: [Object]
    },
    {
      id: 'batch100-chunk1',
      score: 0.809418201,
      values: [Array],
      sparseValues: undefined,
      metadata: [Object]
    },
    {
      id: 'batch300-chunk3',
      score: 0.806505084,
      values: [Array],
      sparseValues: undefined,
      metadata: [Object]
    }
  ],
  namespace: ''
}
Pinecone returned 5 matches.
Top result from Pinecone:  {
  id: 'batch300-chunk5',
  score: 0.82536006,
  values: [
    -0.00627459818, -0.000171131396,     0.0190629605,   -0.0201321747,
     -0.0170370806,    0.0108328266,    -0.0122678243,  -0.00528276153,
     -0.0217641331,   -0.0186409019,    0.00977768097,    0.0128305685,
     -0.0122256186,  -0.00909535307,  -0.000311927375,     -0.00529683,
       0.016769778,   0.00581736863,    -0.0023441813,   0.00901094172,
     -0.0157990437,  -0.00549730752,    -0.0414742492,  -0.00964402873,
    -0.00238462863,    0.0207511932,     0.0125280935,   -0.0170511492,
     0.00725236628,   0.00732974336,     -0.000721016,  -0.00974954385,
      0.0113603994,   -0.0155176716,     -0.031260442,   -0.0112619186,
     -0.0268710367,   0.00247959164,      0.019175509,  -0.00189926173,
      0.0116628744,   0.00247431593,    0.00045283325,     0.017684238,
     0.00746339513,   -0.0122396871,  -0.000488004764,    -0.029741032,
     -0.0221017785,    0.0478613973,    0.00853964314,  -0.00960885733,
     -0.0308383834,   -0.0136254448,     0.0384635665,     0.018317325,
       -0.01074138,    0.0243949629, -0.0000438544812,  -0.00673182774,
     0.00327798515,   -0.0167416409,    -0.0117261829,     0.018542422,
    -0.00741415517,     0.016769778,    -0.0259706452,    0.0173043851,
     -0.0119723836,    0.0186268333,     0.0184298735,    0.0126828477,
      0.0227630045,  0.000423816731,     0.0155317402,   -0.0311478935,
     -0.0158412494,   -0.0242120698,   -0.00794172753, -0.000246860058,
    -0.00756187551,   -0.0176983066,  -0.000417002273,    0.0181766376,
     0.00458636554,    -0.004952149,   -0.00370707759,    0.0201181062,
     -0.0268569682, -0.000733326073,   -0.00614094641,    0.0545017794,
      0.0112759871, 0.0000447612474,    -0.0146735553,  -0.00976361241,
    -0.00508580077,    0.0321608335,   -0.00653135031,   -0.0188097265,
    ... 1436 more items
  ],
  sparseValues: undefined,
  metadata: {
    loc: '{"lines":{"from":1,"to":1}}',
    pageContent: '83 | Version: GG9 incorporating the Purple Guide, August 2022 called to a support meeting with their Postgraduate Dean/RO or their nominated deputy to discuss the reasons for non-submission and to clarify next steps if the situation is not rectified. 4.127 If a trainee submits or resubmits a completed Form R or SOAR within the two-week timeframe, they receive an ARCP outcome appropriate for their educational progression and alignment with the GMC’s standards in Good Medical Practice. 4.128 If the trainee still fails to submit a satisfactorily completed Form R or SOAR after two weeks and this is the first time that this situation has arisen in the training programme, for foundation, core, specialty and general practice trainees, an Outcome 2 (not applicable in foundation), 3 or 4 will be issued (according to training progression). A note is made on the trainee’s record that they did not submit a completed Form R or SOAR. An Outcome 1 or 6 is not awarded, even if there are no training',
    source: 'Page: 83'
  }
}
Top result's metadata from Pinecone:  {
  loc: '{"lines":{"from":1,"to":1}}',
  pageContent: '83 | Version: GG9 incorporating the Purple Guide, August 2022 called to a support meeting with their Postgraduate Dean/RO or their nominated deputy to discuss the reasons for non-submission and to clarify next steps if the situation is not rectified. 4.127 If a trainee submits or resubmits a completed Form R or SOAR within the two-week timeframe, they receive an ARCP outcome appropriate for their educational progression and alignment with the GMC’s standards in Good Medical Practice. 4.128 If the trainee still fails to submit a satisfactorily completed Form R or SOAR after two weeks and this is the first time that this situation has arisen in the training programme, for foundation, core, specialty and general practice trainees, an Outcome 2 (not applicable in foundation), 3 or 4 will be issued (according to training progression). A note is made on the trainee’s record that they did not submit a completed Form R or SOAR. An Outcome 1 or 6 is not awarded, even if there are no training',
  source: 'Page: 83'
}
Now querying GPT-3 with question... : When do I have to submit a Form R?
Answer: You are required to submit a Form R annually, except for F1 doctors who do not need to submit it. The completed Form R needs to be submitted before your ARCP (Annual Review of Competence Progression) to ensure your registration is renewed on an annual basis.
```
