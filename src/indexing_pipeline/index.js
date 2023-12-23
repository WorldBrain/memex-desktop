const {
    splitContentInReasonableChunks,
    extractEntitiesFromText,
} = require('./utils.js')
const log = require('electron-log')
const TurndownService = require('turndown')

async function indexDocument({
    fullUrlInput,
    pageTitleInput,
    fullHTMLInput,
    createdWhenInput,
    contentTypeInput,
    sourceApplicationInput,
    creatorIdInput,
    embedTextFunction,
    allTables,
    entityExtractionFunction,
}) {
    let fullUrl = fullUrlInput || ''
    let pageTitle = pageTitleInput || ''
    let createdWhen = createdWhenInput || ''
    let contentType = contentTypeInput || ''
    let creatorId = creatorIdInput || ''
    let sourceApplication = sourceApplicationInput || ''
    let fullHTML = fullHTMLInput || ''
    try {
        var contentChunks = []
        if (contentType === 'annotation') {
            var turndownService = new TurndownService()
            contentChunks = [turndownService.turndown(fullHTML)]
        } else if (contentType === 'pdf') {
            fullHTML = JSON.parse(fullHTML)
            contentChunks = fullHTML.map((item) => Object.values(item)[0])
        } else {
            if (!fullHTML) {
                try {
                    var response = await fetch(fullUrl)
                    fullHTML = await response.text()
                } catch (error) {
                    console.error(error)
                }
            }
            contentChunks = await splitContentInReasonableChunks(fullHTML)
        }

        if (contentChunks.length === 0) {
            return false
        }

        const chunksToWrite = []
        for (let chunk of contentChunks) {
            const embeddedChunk = await embedTextFunction(pageTitle + chunk)
            const vectors = embeddedChunk[0].data

            var documentToIndex = {
                fullurl: fullUrl,
                pagetitle: pageTitle,
                sourceapplication: sourceApplication,
                createdwhen: createdWhen || Date.now(),
                creatorid: creatorId || '',
                contenttype: contentType || '',
                contenttext: chunk,
                entities: '',
                vector: Array.from(vectors),
            }

            // console.log('documentToIndex', {
            //     fullurl: documentToIndex.fullurl,
            //     pagetitle: documentToIndex.pagetitle,
            //     sourceapplication: documentToIndex.sourceapplication,
            //     createdwhen: documentToIndex.createdwhen,
            //     creatorid: documentToIndex.creatorid,
            //     contenttype: documentToIndex.contenttype,
            //     contenttext: documentToIndex.contenttext,
            //     entities: documentToIndex.entities,
            // })

            chunksToWrite.push(documentToIndex)
        }

        const vectorDocsTable = allTables.vectorDocsTable
        if (vectorDocsTable) {
            await vectorDocsTable.add(chunksToWrite)
            await new Promise((resolve) => setTimeout(resolve, 100))
            await vectorDocsTable.cleanupOldVersions(1)
        }
        console.log('Successfully indexed: ', fullUrl)
        log.log('Successfully indexed: ', fullUrl)
        return true
    } catch (error) {
        console.log('Failure indexing: ', fullUrl, ' ', error)
        log.log('Failure indexed: ', fullUrl, ' ', error)
        return false
    }
}

module.exports = { indexDocument }
