const { splitContentInReasonableChunks } = require("./utils.js");
const TurndownService = require("turndown");
const log = require("electron-log");

async function indexDocument(req, res, embedTextFunction, allTables) {
  console.log("arrives");
  var document = req.body;
  var originalText = req.body.contentText;
  try {
    if (!originalText) {
      var htmlContent = "";
      try {
        var response = await fetch("https://" + req.body.normalizedUrl);
        htmlContent = await response.text();
      } catch (error) {
        console.error(error);
      }
      originalText = htmlContent;
    }
    var contentChunks = [];
    if (document.contentType === "page") {
      contentChunks = await splitContentInReasonableChunks(originalText);
    }
    if (document.contentType === "rss-feed-item") {
      contentChunks = await splitContentInReasonableChunks(originalText);
    }

    if (document.contentType === "annotation") {
      var turndownService = new TurndownService();
      var markdownText = turndownService.turndown(originalText);
      contentChunks = [markdownText];
    }

    let promises = [];
    for (var chunk of contentChunks) {
      const embeddedChunk = await embedTextFunction(chunk);
      const vectors = embeddedChunk[0].data;

      var documentToIndex = {
        sourceapplication: "Memex",
        pagetitle: req.body.pageTitle,
        normalizedurl: req.body.normalizedUrl,
        createdwhen: req.body.createdWhen,
        userid: req.body.userId,
        contenttype: req.body.contentType,
        contenttext: chunk,
        vector: Array.from(vectors),
      };

      console.log("documetnToIndex", documentToIndex);

      const vectorDocsTable = allTables.vectorDocsTable;
      if (vectorDocsTable) {
        promises.push(vectorDocsTable.add([documentToIndex]));
      }
    }
    for (const promise of promises) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await promise;
    }
    return res.status(200).send(true);
  } catch (error) {
    log.error("Error in /index_document", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { indexDocument };
