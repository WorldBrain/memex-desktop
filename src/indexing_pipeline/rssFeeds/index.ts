import { indexDocument } from '../index.js'
import { cleanFullHTML } from '../utils.js'
import * as xml2js from 'xml2js'
import * as cheerio from 'cheerio'
import { extract as extractFeed } from '@extractus/feed-extractor'
import * as log from 'electron-log'

interface Tables {
    rssSourcesTable: any
    sourcesDB: any
}

interface FeedData {
    feedUrl: string
    feedTitle: string
    lastSynced: null | Date
}

interface PageData {
    fullHTML: string
    cleanHTML: string
    fullUrl: string
    pageTitle?: string
    contentType: string
    createdWhen: number
    sourceApplication: string
    creatorId: string | undefined
    metaDataJSON: string
}

async function getAllRSSSources(allTables: Tables): Promise<any> {
    const rssSourcesTable = allTables.rssSourcesTable
    const allRSSSources = await rssSourcesTable.getAll()

    return allRSSSources
}

async function addFeedSource(
    feedUrl: string,
    feedTitle: string,
    embedTextFunction: Function,
    allTables: Tables,
    type: string,
    entityExtractionFunction: Function,
): Promise<boolean> {
    try {
        const sourcesDB = allTables.sourcesDB

        let existingEndpoint: any
        try {
            existingEndpoint = await sourcesDB.get(
                `SELECT * FROM rssSourcesTable WHERE feedUrl = ? AND lastSynced IS NOT NULL`,
                [feedUrl],
            )
        } catch (error) {
            log.error('Error checking existing endpoint')
            return false
        }

        if (existingEndpoint) {
            console.log('Feed Already Saved: ', feedUrl)
            return true
        }

        const feedDataToSave: FeedData = {
            feedUrl: feedUrl,
            feedTitle: feedTitle,
            lastSynced: null,
        }

        let isSubstack =
            feedUrl.includes('.substack.com/') || type === 'substack'

        if (!isSubstack) {
            const url = new URL(feedUrl)
            const feedURLsubstack = `${url.protocol}//${url.host}/feed`
            let parser: xml2js.Parser
            let htmlContent: string

            try {
                const response = await fetch(feedURLsubstack)
                htmlContent = await response.text()
            } catch (error) {
                console.log('error fetching feed', error)
                throw new Error(
                    'error fetching feed:' + (error as Error).message,
                )
            }
            let parsedData: any

            try {
                parser = new xml2js.Parser()
                parser.parseString(htmlContent, function (err, result) {
                    if (err) {
                        console.log('Failed to parse HTML content: ', err)
                    } else {
                        parsedData = result?.rss?.channel[0]
                        const imageUrl = parsedData?.image[0]?.url[0]
                        if (
                            imageUrl &&
                            imageUrl.startsWith('https://substackcdn.com')
                        ) {
                            isSubstack = true
                        }
                    }
                })
            } catch (error) {
                console.log('Failed to parse out xml content: ', error)
                log.log('Failed to parse out xml content: ', error)
            }
        }

        if (isSubstack) {
            let links: string[] = []

            const url = new URL(feedUrl)
            // route them to the substack page that has all the links to all postss
            const feedUrlSubstack = `${url.protocol}//${url.host}/sitemap`

            // find all links that are to the YEAR pages in the substack sitemap
            const allSiteMapPages: string[] = []
            const response = await fetch(feedUrlSubstack)
            const text = await response.text()

            const $ = cheerio.load(text)
            const anchors = $('a')

            anchors.each((i, anchor) => {
                const href = $(anchor).attr('href')
                if (href?.startsWith('/sitemap')) {
                    allSiteMapPages.push(href)
                }
            })

            // find all links to POSTS that are on each of the year pages in the substack sitemap

            for (let page of allSiteMapPages) {
                const siteMapPageUrl = `${url.protocol}//${url.host}${page}`
                const pageResponse = await fetch(siteMapPageUrl)
                const pageText = await pageResponse.text()
                const $page = cheerio.load(pageText)
                const pageAnchors = $page('a')

                pageAnchors.each((i, anchor) => {
                    const href = $page(anchor).attr('href')
                    if (
                        href?.startsWith(`${feedUrl.replace('/feed', '')}/p/`)
                    ) {
                        links.push(href)
                    }
                })
            }

            if (links && links.length === 0) {
                return false
            }

            // fetch all the links content and index them

            for (let link of links) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                const response = await fetch(link, {
                    headers: {
                        Accept: 'text/html',
                    },
                })
                const fullHTML = await response.text()
                const cleanHTML = await cleanFullHTML(fullHTML)

                const $ = cheerio.load(fullHTML)
                let metaDataTags

                // get the page metadata containing lots of useful information about the post we can use later
                try {
                    const scripts = $('script')
                    const jsonScript = scripts
                        .filter(
                            (i, script) =>
                                $(script).attr('type') ===
                                'application/ld+json',
                        )
                        .first()

                    const scriptHtml = jsonScript.html()
                    if (scriptHtml) {
                        metaDataTags = JSON.parse(scriptHtml)
                    }
                } catch (error) {}

                // get the publication time
                const datePublishedUnix = metaDataTags?.datePublished
                    ? new Date(metaDataTags?.datePublished)?.getTime() / 1000
                    : 0

                // get the title of the posts
                const title = $('title').text() || metaDataTags.headline

                // create the pageItem to save
                const pageDataToSave: PageData = {
                    fullUrl: link,
                    pageTitle: title,
                    cleanHTML: cleanHTML,
                    fullHTML: fullHTML,
                    contentType: 'rss-feed-item',
                    createdWhen: datePublishedUnix,
                    sourceApplication: 'RSS',
                    creatorId: '',
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
        } else {
            // Cover all the other use cases where the link is a rss/xml feed

            // get the feed data, first page
            let feedResult
            try {
                feedResult = await extractFeed(feedUrl)
            } catch (error) {
                log.log('error extracting feed:', error, feedUrl)
                throw new Error(
                    'error extracting feed:' + (error as Error).message,
                )
            }

            // Fetch and index each page's data for this feed
            if (feedResult && feedResult.entries) {
                for (const entry of feedResult.entries) {
                    if (!entry?.link) {
                        return false
                    }
                    const response = await fetch(entry?.link, {
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
                                    $(script).attr('type') ===
                                    'application/ld+json',
                            )
                            .first()

                        const scriptHtml = jsonScript.html()
                        if (scriptHtml) {
                            metaDataTags = JSON.parse(scriptHtml)
                        }
                    } catch (error) {
                        log.warn('Could not parse JSON metadata :', entry.link)
                    }

                    const datePublishedUnix = entry.published
                        ? new Date(entry.published).getTime() / 1000
                        : 0

                    const pageDataToSave: PageData = {
                        fullHTML,
                        cleanHTML,
                        fullUrl: entry.link,
                        pageTitle: entry.title,
                        contentType: 'rss-feed-item',
                        createdWhen: datePublishedUnix,
                        sourceApplication: 'RSS',
                        creatorId: '', // TODO: no easy way to get creator data for any webpage
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
            }
        }

        // if indexing the feed was successful update the rsssourcestable with the lastSynced date
        try {
            console.log('update rssSourcesTable', feedUrl, feedDataToSave)
            const sql = `INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)`
            await sourcesDB.run(sql, [
                feedDataToSave.feedUrl,
                feedDataToSave.feedTitle,
                isSubstack ? 'substack' : type,
                Date.now(),
            ])
            return true
        } catch (error) {
            console.log('Error saving feed to database: ', feedUrl, error)
        }
    } catch (error) {
        console.log('error indexing rss feed', error)
        return false
    }
    return true
}

// TODOS

// add the RSS feed source to the cron job

// index the RSS feed source and set the last indexed date to now

async function saveAndIndexFeedPages(
    sourcesDB: any,
    pageDataToSave: PageData,
    embedTextFunction: any,
    allTables: any,
    entityExtractionFunction: any,
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
        console.log('Page Already Saved: ', error)
        return
    }

    try {
        await indexDocument({
            fullUrl: pageDataToSave.fullUrl,
            pageTitle: pageDataToSave.pageTitle,
            fullHTML: pageDataToSave.cleanHTML,
            contentType: 'rss-feed-item',
            sourceApplication: 'RSS',
            embedTextFunction: embedTextFunction,
            allTables: allTables,
            entityExtractionFunction: entityExtractionFunction,
        })
    } catch (error) {
        console.log('Error indexing:', error)
    }
}

export { addFeedSource, getAllRSSSources }
