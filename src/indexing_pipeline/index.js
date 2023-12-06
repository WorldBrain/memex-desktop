const { splitContentInReasonableChunks } = require("./utils.js");
const log = require("electron-log");

async function indexDocument(
  fullUrlInput,
  pageTitleInput,
  fullHTMLInput,
  createdWhenInput,
  contentTypeInput,
  sourceApplicationInput,
  creatorIdInput,
  embedTextFunction,
  allTables
) {
  let fullUrl = fullUrlInput || "";
  let pageTitle = pageTitleInput || "";
  let createdWhen = createdWhenInput || "";
  let contentType = contentTypeInput || "";
  let creatorId = creatorIdInput || "";
  let sourceApplication = sourceApplicationInput || "";
  let fullHTML = fullHTMLInput || "";

  try {
    if (!fullHTML) {
      try {
        var response = await fetch(fullUrl);
        fullHTML = await response.text();
      } catch (error) {
        console.error(error);
      }
    }
    var contentChunks = [];
    contentChunks = await splitContentInReasonableChunks(fullHTML);

    let promises = [];
    for (var chunk of contentChunks) {
      const embeddedChunk = await embedTextFunction(chunk);
      const vectors = embeddedChunk[0].data;

      var documentToIndex = {
        fullurl: fullUrl,
        pagetitle: pageTitle,
        sourceapplication: sourceApplication,
        createdwhen: createdWhen || Date.now(),
        creatorid: creatorId || "",
        contenttype: contentType || "",
        contenttext: chunk,
        vector: Array.from(vectors),
      };

      console.log("documentToIndex", documentToIndex);

      const vectorDocsTable = allTables.vectorDocsTable;
      if (vectorDocsTable) {
        promises.push(vectorDocsTable.add([documentToIndex]));
      }
    }
    for (const promise of promises) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await promise;
      } catch (error) {
        console.error("An error occurred:", error);
      }
    }
    return true;
  } catch (error) {
    console.log("error", error);
    return false;
  }
}

module.exports = { indexDocument };
