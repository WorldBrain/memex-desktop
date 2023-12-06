// function that takes a new RSS feed source and saves it, puts it into the cron job and regularly fetches it

const { indexDocument } = require("../index.js");
const { cleanFullHTML } = require("../utils.js");
var JSDOM = require("jsdom").JSDOM;

async function getAllRSSSources(allTables) {
  const rssSourcesTable = allTables.rssSourcesTable;
  const allRSSSources = await rssSourcesTable.getAll();

  console.log("allRSSSources", allRSSSources);

  return allRSSSources;
}

async function addRSSFeedSource(
  feedUrl,
  embedTextFunction,
  allTables,
  isSubstack
) {
  try {
    // check if the RSS feed source already exists in the database

    const sourcesDB = allTables.sourcesDB;

    console.log("sourcesDB", sourcesDB);

    // let existingEndpoint;
    // try {
    //   existingEndpoint = await rssEndpointsTable.get(feedUrl);
    //   console.log("test", existingEndpoint);
    //   if (existingEndpoint.length > 0) {
    //     new Error(`RSS feed already exists: ${feedUrl}`);
    //     return false;
    //   }
    // } catch (error) {
    //   console.log("error", error);
    // }

    let feedURLprocessed;

    if (feedUrl.startsWith("https://substack.com/") || isSubstack) {
      feedURLprocessed = feedUrl + "/feed";
    }

    let feedData;
    try {
      const response = await fetch(feedURLprocessed);
      if (response.ok) {
        // if HTTP-status is 200-299
        // get the response body (the method explained below)
        feedData = await response.text();
      } else {
        console.error("HTTP-Error: " + response.status);
      }
    } catch (error) {
      console.error("Failed to load RSS feed: ", error);
    }

    const dom = new JSDOM(feedData);
    let xmlDoc = dom.window.document;
    let feedTitleNode = xmlDoc
      .getElementsByTagName("channel")[0]
      .getElementsByTagName("title")[0];
    let feedTitle = feedTitleNode.textContent || feedTitleNode.innerText;
    feedTitle = feedTitle.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");
    feedTitle = feedTitle || feedTitleNode.innerText;
    // let feedDescription = xmlDoc
    //   .getElementsByTagName("channel")[0]
    //   .getElementsByTagName("description").textContent;
    // let feedIcon = xmlDoc
    //   .getElementsByTagName("channel")[0]
    //   .getElementsByTagName("image")[0].childNodes[0].nodeValue;

    const RSSfeedData = {
      feedUrl: feedUrl,
      feedTitle: feedTitle,
      // feedIcon: feedIcon,
      // feedDescription: feedDescription,
      lastSynced: Date.now(),
    };

    try {
      const sql = `INSERT INTO rssSourcesTable VALUES (?, ?, ?, ?)`;
      sourcesDB.run(sql, [
        RSSfeedData.feedUrl,
        RSSfeedData.feedTitle,
        isSubstack,
        RSSfeedData.lastSynced,
      ]);
    } catch (error) {
      console.log("Feed Already Saved");
    }

    console.log("test");

    if (isSubstack) {
      let year = 2023;
      let links = [];
      let fetchedAllHistory = false;

      while (!fetchedAllHistory) {
        const urlToFetch = `${feedUrl}/sitemap/${year}`;
        const response = await fetch(urlToFetch);
        if (response.status === 404) {
          fetchedAllHistory = true;
        }
        const text = await response.text();
        const dom = new JSDOM(text);

        const anchors = dom.window.document.querySelectorAll("a");
        anchors.forEach((anchor) => {
          const href = anchor.getAttribute("href");
          if (href.startsWith(`${feedUrl}/p/`)) {
            links.push(href);
          }
        });
        year--;
      }

      let pageRawData;
      for (let link of links) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await fetch(link, {
          headers: {
            Accept: "text/html",
          },
        });
        const fullHTML = await response.text();
        const cleanHTML = await cleanFullHTML(fullHTML);

        const dom = new JSDOM(cleanHTML);
        const head = dom.window.document.getElementsByTagName("head")[0];
        // const body = dom.window.document.getElementsByTagName("body")[0];

        const title =
          head
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") || "";
        // const metaTags = head.querySelectorAll("meta");

        // let creationDate = "";
        // body.getElemn.forEach((meta) => {
        //   if (meta.getAttribute("name")) {
        //     creationDate = meta.getAttribute("content");
        //   }
        // });

        const pageDataToSave = {
          fullUrl: link,
          createdWhen: "",
          pageTitle: title,
          fullHTML: cleanHTML,
          sourceApplication: "RSS",
          creatorId: null,
        };

        try {
          await new Promise((resolve, reject) => {
            sourcesDB.run(
              `INSERT INTO webPagesTable VALUES(?, ?, ?, ?, ?, ?)`,
              [
                pageDataToSave.fullUrl,
                pageDataToSave.createdWhen,
                pageDataToSave.pageTitle,
                pageDataToSave.fullHTML,
                pageDataToSave.sourceApplication,
                pageDataToSave.creatorId,
              ],
              function(err) {
                if (err) {
                  console.log("err", err); // 'statement' failed: UNIQUE constraint failed: pagesTable._id
                  return reject(err);
                }
                resolve();
              }
            );
          });
        } catch (error) {
          console.log(("Page Already Saved: ", error));
        }

        try {
          await indexDocument(
            link,
            title,
            cleanHTML,
            "",
            "rss-feed-item",
            "RSS",
            "",
            embedTextFunction,
            allTables
          );
        } catch (error) {
          console.log("Error indexing:", error);
        }
      }

      return true;
    }
  } catch (error) {
    console.log("error indexing rss feed", error);
    return false;
  }

  // TODOS

  // add the RSS feed source to the cron job

  // index the RSS feed source and set the last indexed date to now
}

module.exports = { addRSSFeedSource, getAllRSSSources };

// export async function indexRSSfeed(feedData) {
//   const isExisting = null; // fetch local database entry and see if there is one already

//     let items = xmlDoc.getElementsByTagName("item");

//     const articles = [];
//     for (let i = 0; i < items.length; i++) {
//       let item = items[i];
//       // You can now use the item variable to access each item in the RSS feed

//       let title = item.getElementsByTagName("title")[0].textContent;

//       // [0].childNodes[0].nodeValue
//       let description = item.getElementsByTagName("description")[0].textContent;
//       let link = item.getElementsByTagName("link")[0].textContent;
//       let pubDate = item.getElementsByTagName("pubDate")[0].textContent;
//       let content = item.getElementsByTagName("content:encoded")[0].textContent;
//       let createdWhen = new Date(pubDate).getTime();

//       // Create a new DOMParser to parse the HTML string
//       let parser = new DOMParser();
//       // Parse the HTML string to a document
//       let contentDoc = parser.parseFromString(content, "text/html");
//       // Get the innerText of the document
//       const textContent = contentDoc.body.innerText;

//       const document = {
//         listId: ListData.localListId,
//         pageUrl: normalizeUrl(link),
//         fullUrl: link,
//         createdAt: createdWhen,
//         pageTitle: title,
//         isShared: false,
//         dontTrack: true,
//       };

//       articles.push(document);
//     }
//   } catch (error) {
//     console.error("Error:", error);
//   }

//   // save the RSS feed core data to the RSS feed table

//   // save each article into the article database with the type "rss-feed-item"

//   // index each article into the vector index database
// }

// function to regularly check for updates to RSS feeds

// function to fetch the content of a single RSS feed

// function to save changes from the RSS feed

// function to
