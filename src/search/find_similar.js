const log = require("electron-log");

async function findSimilar(req, res, embedTextFunction, allTables) {
  try {
    console.log("arrives");
    // var vectorQuery = await embedContent(preparedContentText);
    const embeddedChunk = await embedTextFunction(req.body.contentText);
    const vectors = embeddedChunk[0].data;

    const vectorDocsTable = allTables.vectorDocsTable;

    console.log("vectorDocsTable", vectors);

    var result = await vectorDocsTable
      .search(Array.from(vectors))
      .metricType("L2")
      .where(
        `normalizedurl != '${req.body.normalizedUrl}' AND createdwhen != 0`
      )
      .limit(30)
      .execute();

    var filteredResult = result
      .reduce(function(acc, current) {
        var x = acc.find(function(item) {
          return (
            item.normalizedurl === current.normalizedurl && // only take one instance of a page result
            (item.contenttype === "page" ||
              item.contenttype === "rss-feed-item")
          );
        });

        if (current.contenttype === "annotation") {
          var splitUrl = current.normalizedurl.split("/#");
          if (splitUrl[0] === req.body.normalizedUrl) {
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
        sourceApplication: "Memex",
        pageTitle: item.pagetitle,
        normalizedUrl: item.normalizedurl,
        createdWhen: item.createdwhen,
        userId: item.userid,
        contentType: item.contenttype,
        contentText: item.contenttext,
        distance: item._distance,
      };
    });

    console.log("filteredResult", filteredResult);

    return res.status(200).send(filteredResult);
  } catch (error) {
    log.error("Error in /find_similar", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { findSimilar };
