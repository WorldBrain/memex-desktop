// function that takes a new RSS feed source and saves it, puts it into the cron job and regularly fetches it

const { indexDocument } = require('../index.js')
const { cleanFullHTML } = require('../utils.js')
const xml2js = require('xml2js')
const jsdom = require('jsdom')
const cheerio = require('cheerio')
const { extract: extractFeed } = require('@extractus/feed-extractor')

const { JSDOM } = jsdom

async function getAllRSSSources(allTables) {
    const rssSourcesTable = allTables.rssSourcesTable
    const allRSSSources = await rssSourcesTable.getAll()

    return allRSSSources
}

// TODO: Need some way to support generic pagination
async function addFeedSource(
    feedUrl,
    feedTitle,
    embedTextFunction,
    allTables,
    type,
    entityExtractionFunction,
) {
    try {
        // check if the RSS feed source already exists in the database
        const sourcesDB = allTables.sourcesDB

        // check if feed entry already exists
        let existingEndpoint
        try {
            existingEndpoint = await sourcesDB.get(
                `SELECT * FROM rssSourcesTable WHERE feedUrl = ? AND lastSynced IS NOT NULL`,
                [feedUrl],
            )

            console.log('existingEndpoint', existingEndpoint)
        } catch (error) {
            log.error('Error checking existing endpoint')
            return
        }

        if (existingEndpoint) {
            console.log('Feed Already Saved')
            return
        }

        const feedDataToSave = {
            feedUrl: feedUrl,
            feedTitle: feedTitle,
            // feedIcon: feedIcon,
            // feedDescription: feedDescription,
            lastSynced: null,
        }

        // prepare Substack link structure
        let isSubstack =
            feedUrl.includes('.substack.com/') || type === 'substack'

        let feedURLprocessed = feedUrl

        if (isSubstack && !feedURLprocessed.endsWith('/feed')) {
            const url = new URL(feedUrl)
            feedURLprocessed = `${url.protocol}//${url.host}/feed`
        }

        const feedResult = await extractFeed(feedUrl)

        // Fetch and index each page's data for this feed
        for (const entry of feedResult.entries) {
            const response = await fetch(entry.link, {
                headers: {
                    Accept: 'text/html',
                },
            })
            const fullHTML = await response.text()
            const cleanHTML = await cleanFullHTML(fullHTML)

            const $ = cheerio.load(fullHTML)

            // TODO: This does not seem to be a reliable way of getting generic webpage metadata
            //  What metadata are we actually interested in here?
            let metaDataTags
            try {
                const scripts = $('script')
                const jsonScript = scripts
                    .filter(
                        (i, script) =>
                            $(script).attr('type') === 'application/ld+json',
                    )
                    .first()

                metaDataTags = JSON.parse(jsonScript.html())
            } catch (error) {
                log.warn('Could not parse JSON metadata :', entry.link)
            }

            const datePublishedUnix = entry.published
                ? new Date(entry.published).getTime() / 1000
                : 0

            const pageDataToSave = {
                fullHTML,
                cleanHTML,
                fullUrl: entry.link,
                pageTitle: entry.title,
                contentType: 'rss-feed-item',
                createdWhen: datePublishedUnix,
                sourceApplication: 'RSS',
                creatorId: undefined, // TODO: no easy way to get creator data for any webpage
                metaDataJSON: JSON.stringify(metaDataTags) || '',
            }

            await saveAndIndexFeedPages(
                sourcesDB,
                pageDataToSave,
                embedTextFunction,
                allTables,
                entityExtractionFunction,
            )
        }

        try {
            console.log('update rssSourcesTable', feedURLprocessed)
            const sql = `INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)`
            await sourcesDB.run(sql, [
                feedDataToSave.feedUrl,
                feedDataToSave.feedTitle,
                isSubstack ? 'substack' : type,
                Date.now(),
            ])
            return true
        } catch (error) {
            console.log('Feed Already Saved')
        }
    } catch (error) {
        console.log('error indexing rss feed', error)
        return false
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
    entityExtractionFunction,
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
            ],
        )
    } catch (error) {
        console.log(('Page Already Saved: ', error))
        return
    }

    try {
        await indexDocument(
            pageDataToSave.fullUrl,
            pageDataToSave.pageTitle,
            pageDataToSave.cleanHTML,
            '',
            'rss-feed-item',
            'RSS',
            '',
            embedTextFunction,
            allTables,
            entityExtractionFunction,
        )
    } catch (error) {
        console.log('Error indexing:', error)
    }
}

module.exports = { addFeedSource, getAllRSSSources }

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
