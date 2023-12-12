// function that takes a new RSS feed source and saves it, puts it into the cron job and regularly fetches it

const { indexDocument } = require("../index.js");
const { cleanFullHTML } = require("../utils.js");
const xml2js = require("xml2js");
const jsdom = require("jsdom");
const cheerio = require("cheerio");

const { JSDOM } = jsdom;

async function getAllRSSSources(allTables) {
  const rssSourcesTable = allTables.rssSourcesTable;
  const allRSSSources = await rssSourcesTable.getAll();

  return allRSSSources;
}

async function addFeedSource(
  feedUrl,
  feedTitle,
  embedTextFunction,
  allTables,
  type,
  entityExtractionFunction
) {
  try {
    // check if the RSS feed source already exists in the database
    const sourcesDB = allTables.sourcesDB;
    feedTitle = feedTitle;

    // prepare Substack link structure
    const isSubstack =
      feedUrl.includes(".substack.com/") || type === "substack";

    let feedURLprocessed = feedUrl;

    if (isSubstack && !feedURLprocessed.endsWith("/feed")) {
      const url = new URL(feedUrl);
      feedURLprocessed = `${url.protocol}//${url.host}/feed`;
    }

    // check if feed entry already exists
    let existingEndpoint;
    try {
      existingEndpoint = await sourcesDB.get(
        `SELECT * FROM rssSourcesTable WHERE feedUrl = ? AND lastSynced IS NOT NULL`,
        [feedUrl]
      );
    } catch (error) {}

    if (existingEndpoint) {
      console.log("Feed Already Saved");
      return;
    }

    let feedDataToSave = {
      feedUrl: feedUrl,
      feedTitle: feedTitle,
      // feedIcon: feedIcon,
      // feedDescription: feedDescription,
      lastSynced: null,
    };

    let feedData;

    if (isSubstack) {
      let year = 2023;
      let links = [];
      let fetchedAllHistory = false;

      try {
        const response = await fetch(feedURLprocessed);
        if (response.ok) {
          // if HTTP-status is 200-299
          // get the response body (the method explained below)
          feedData = await response.text();
        } else {
          feedData = null;
          console.error("HTTP-Error: " + response.status);
          return;
        }
      } catch (error) {
        feedData = null;
        console.error("Failed to load RSS feed: ", error);
        return;
      }

      const parser = new xml2js.Parser();
      let parsedData;

      parser.parseString(feedData, function(err, result) {
        if (err) {
          console.error("Failed to parse RSS feed: ", err);
        } else {
          parsedData = result.rss.channel[0];
        }
      });

      if (!feedTitle || feedTitle.length === 0) {
        feedDataToSave.feedTitle = parsedData.title[0];
      }

      while (!fetchedAllHistory) {
        const urlToFetch = `${feedUrl.replace("/feed", "")}/sitemap/${year}`;
        const response = await fetch(urlToFetch);
        if (response.status === 404) {
          fetchedAllHistory = true;
        }
        const text = await response.text();
        const $ = cheerio.load(text);
        const anchors = $("a");

        anchors.each((i, anchor) => {
          const href = $(anchor).attr("href");
          if (href.startsWith(`${feedUrl.replace("/feed", "")}/p/`)) {
            links.push(href);
          }
        });
        year--;
      }

      for (let link of links) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await fetch(link, {
          headers: {
            Accept: "text/html",
          },
        });
        const fullHTML = await response.text();
        const cleanHTML = await cleanFullHTML(fullHTML);

        const $ = cheerio.load(fullHTML);
        let metaDataTags;

        try {
          const scripts = $("script");
          const jsonScript = scripts
            .filter(
              (i, script) => $(script).attr("type") === "application/ld+json"
            )
            .first();

          metaDataTags = JSON.parse(jsonScript.html());
        } catch (error) {}

        const datePublishedUnix =
          new Date(metaDataTags.datePublished)?.getTime() / 1000 || 0;
        const title = $("title").text() || metaDataTags.headline;

        const pageDataToSave = {
          fullUrl: link,
          pageTitle: title,
          cleanHTML: cleanHTML,
          contentType: "rss-feed-item",
          createdWhen: datePublishedUnix,
          sourceApplication: "RSS",
          creatorId: "",
          metaDataJSON: JSON.stringify(metaDataTags) || "",
        };

        saveAndIndexFeedPages(
          sourcesDB,
          pageDataToSave,
          embedTextFunction,
          allTables,
          entityExtractionFunction
        );
      }
    } else {
      let previousFeedData = feedData;
      let page = 1;

      while (feedData) {
        // sometimes the page logic does not work and its the same page result bc of meaning less query params
        // catches this and then stops the loop
        if (previousFeedData === feedData && page > 1) {
          feedData = null;
          return;
        }
        if (page > 0) {
          try {
            const response = await fetch(feedURLprocessed + `?page=${page}`);
            if (response.ok) {
              // if HTTP-status is 200-299
              // get the response body (the method explained below)
              feedData = await response.text();
              previousFeedData = feedData;
            } else {
              feedData = null;
              console.error("HTTP-Error: " + response.status);
              return;
            }
          } catch (error) {
            feedData = null;
            console.error("Failed to load RSS feed: ", error);
            return;
          }
        }

        const parser = new xml2js.Parser();
        let parsedData;
        parser.parseString(feedData, function(err, result) {
          if (err) {
            console.error("Failed to parse RSS feed: ", err);
          } else {
            parsedData = result.rss.channel[0];
          }
        });

        if ((!feedTitle || feedTitle.length === 0) && (page < 1 || !page)) {
          feedDataToSave.feedTitle = parsedData.title[0];
        }

        for (let i = 0; i < parsedData.item.length; i++) {
          let item = parsedData.item[i];
          let title = item.title && item.title[0];
          let link = item.link && item.link[0];
          let fullHTML = "";
          let pubDate = item.pubDate && item.pubDate[0];
          let createdWhen = new Date(pubDate).getTime();
          let creatorId = item.author && item.author[0];

          await fetch(link)
            .then((response) => response.text())
            .then(async (body) => {
              fullHTML = body;
              cleanHTML = await cleanFullHTML(fullHTML);
            })
            .catch((error) => {
              console.error("Failed to load full HTML: ", error);
            });

          // console.log("item", item);
          // title = item.querySelector("title").textContent;
          // link = item.querySelector("link").textContent;
          // pubDate = item.querySelector("pubDate").textContent;
          // content = item.querySelector("content\\:encoded").textContent;
          // createdWhen = new Date(pubDate).getTime();

          const pageDataToSave = {
            fullUrl: link,
            pageTitle: title,
            fullHTML: fullHTML,
            cleanHTML: cleanHTML,
            contentType: "rss-feed-item",
            createdWhen: createdWhen,
            sourceApplication: "RSS",
            creatorId: creatorId,
          };

          saveAndIndexFeedPages(
            sourcesDB,
            pageDataToSave,
            embedTextFunction,
            allTables,
            entityExtractionFunction
          );
        }
        page++;
      }
    }

    try {
      const sql = `INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)`;
      sourcesDB.run(sql, [
        feedDataToSave.feedUrl,
        feedDataToSave.feedTitle,
        type,
        Date.now(),
      ]);
    } catch (error) {
      console.log("Feed Already Saved");
      return;
    }

    return true;
  } catch (error) {
    console.log("error indexing rss feed", error);
    return false;
  }
}

// TODOS

// add the RSS feed source to the cron job

// index the RSS feed source and set the last indexed date to now

async function saveAndIndexFeedPages(
  sourcesDB,
  pageDataToSave,
  embedTextFunction,
  allTables,
  entityExtractionFunction
) {
  try {
    await sourcesDB.run(
      `INSERT INTO webPagesTable VALUES(?, ?, ?, ?, ?, ?, ?, ? )`,
      [
        pageDataToSave.fullUrl,
        pageDataToSave.pageTitle,
        pageDataToSave.cleanHTML,
        pageDataToSave.contentType,
        pageDataToSave.createdWhen,
        pageDataToSave.sourceApplication,
        pageDataToSave.creatorId,
        pageDataToSave.metaDataJSON,
      ]
    );
  } catch (error) {
    console.log(("Page Already Saved: ", error));
    return;
  }

  try {
    await indexDocument(
      pageDataToSave.fullUrl,
      pageDataToSave.pageTitle,
      pageDataToSave.cleanHTML,
      "",
      "rss-feed-item",
      "RSS",
      "",
      embedTextFunction,
      allTables,
      entityExtractionFunction
    );
  } catch (error) {
    console.log("Error indexing:", error);
  }
}

module.exports = { addFeedSource, getAllRSSSources };

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
