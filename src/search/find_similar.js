const log = require("electron-log");

const { extractEntitiesFromText } = require("../indexing_pipeline/utils.js");

async function findSimilar(
  req,
  res,
  embedTextFunction,
  allTables,
  entityExtractionFunction
) {
  try {
    // var vectorQuery = await embedContent(preparedContentText);
    // const entities = await extractEntitiesFromText(
    //   req.body.contentText,
    //   entityExtractionFunction
    // );
    // const embeddedChunk = await embedTextFunction(entities.join(" "));
    const embeddedChunk = await embedTextFunction(req.body.contentText);
    const vectors = embeddedChunk[0].data;

    const vectorDocsTable = allTables.vectorDocsTable;

    // console.log("searched entities", entities);

    var result = await vectorDocsTable
      .search(Array.from(vectors))
      // .metricType("L2")
      .where(`fullurl != '${req.body.fullUrl}' AND createdwhen != 0`)
      .limit(30)
      .execute();

    let filteredResult = result.filter((item) => {
      if (item.contenttype === "annotation") {
        // don't return annotations on the current page
        var splitUrl = item.fullurl?.split("/#");
        if (splitUrl[0] === req.body.fullUrl) {
          return false;
        }
      }
      return item._distance < 1.25 && item.fullurl !== "null";
    });

    // Group by URL and take the one with the lowest distance
    filteredResult = Object.values(
      filteredResult.reduce((acc, item) => {
        if (
          !acc[item.fullurl] ||
          acc[item.fullurl]._distance > item._distance
        ) {
          acc[item.fullurl] = item;
        }
        return acc;
      }, {})
    );

    filteredResult = filteredResult.map(function(item) {
      return {
        fullUrl: item.fullurl,
        pageTitle: item.pagetitle,
        contentText: item.contenttext,
        createdWhen: item.createdwhen,
        contentType: item.contenttype,
        sourceApplication: item.sourceApplication,
        creatorId: item.creatorid,
        distance: item._distance,
        entities: item.entities,
      };
    });

    return res.status(200).send(filteredResult);
  } catch (error) {
    log.error("Error in /find_similar", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { findSimilar };
