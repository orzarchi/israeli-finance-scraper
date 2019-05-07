import * as functions from "firebase-functions";
import main from "./main";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const scrape = functions.https.onRequest(async (request, response) => {
  try {
    main();
    response.send("Done");
  } catch (err) {
    response.status(500).send("error");
  }
});
