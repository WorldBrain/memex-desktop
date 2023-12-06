const log = require("electron-log");

async function findSimilar(req, res, embedTextFunction, allTables) {
  try {
    console.log("arrives", req.body);
    // var vectorQuery = await embedContent(preparedContentText);
    const embeddedChunk = await embedTextFunction(req.body.contentText);
    const vectors = embeddedChunk[0].data;

    const vectorDocsTable = allTables.vectorDocsTable;

    var result = await vectorDocsTable
      .search(Array.from(vectors))
      .metricType("L2")
      .where(`fullurl != '${req.body.fullUrl}' AND createdwhen != 0`)
      .limit(30)
      .execute();

    var filteredResult = result
      .reduce(function(acc, current) {
        var x = acc.find(function(item) {
          console.log(
            "item",
            item.fullurl === current.fullurl,
            item.contenttype
          );
          return (
            item.fullurl === current.fullurl // only take one instance of a page result
            // (item.contenttype === "page" ||
            //   item.contenttype === "rss-feed-item")
          );
        });

        if (current.contenttype === "annotation") {
          console.log("current", current); // don't return annotations on the current page
          var splitUrl = current.fullurl?.split("/#");
          if (splitUrl[0] === req.body.fullUrl) {
            return acc;
          }
        }
        if (!x) {
          return acc.concat([current]);
        } else {
          if (x._distance > current._distance) {
            var index = acc.indexOf(x);
            acc[index] = current;
          }
          return acc;
        }
      }, [])
      .filter(function(item) {
        return item._distance < 2;
      });

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
      };
    });

    return res.status(200).send(filteredResult);
  } catch (error) {
    log.error("Error in /find_similar", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { findSimilar };
