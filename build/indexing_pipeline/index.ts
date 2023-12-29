import { splitContentInReasonableChunks } from './utils.js'
import log from 'electron-log'
import TurndownService from 'turndown'
import removeMarkdown from 'remove-markdown'

interface DocumentParams {
    fullUrl: string
    pageTitle?: string
    fullHTML: string | string[]
    createdWhen?: number
    contentType?: string
    sourceApplication?: string
    creatorId?: string
    embedTextFunction: (text: string) => Promise<any>
    allTables: any
    entityExtractionFunction?: Function | null
}

async function indexDocument({
    fullUrl,
    pageTitle,
    fullHTML,
    createdWhen,
    contentType,
    sourceApplication,
    creatorId,
    embedTextFunction,
    allTables,
    entityExtractionFunction,
}: DocumentParams): Promise<boolean> {
    let fullHTMLParsed = null
    try {
        var contentChunks: string[] = []
        if (contentType === 'annotation') {
            var turndownService = new TurndownService()
            contentChunks = [
                turndownService.turndown(
                    Array.isArray(fullHTML) ? fullHTML.join(' ') : fullHTML,
                ),
            ]
        } else if (contentType === 'pdf') {
            if (typeof fullHTML === 'string') {
                fullHTMLParsed = JSON.parse(fullHTML)
                contentChunks = fullHTMLParsed.map(
                    (item: any) => Object.values(item)[0],
                )
            }
        } else if (contentType === 'markdown') {
            contentChunks = Array.isArray(fullHTML)
                ? fullHTML
                : [fullHTML || '']
        } else {
            if (!fullHTML) {
                try {
                    var response = await fetch(fullUrl)
                    fullHTML = await response.text()
                } catch (error) {
                    console.error(error)
                }
            }
            contentChunks = await splitContentInReasonableChunks(
                Array.isArray(fullHTML) ? fullHTML.join(' ') : fullHTML,
            )
        }

        if (contentChunks.length === 0) {
            return false
        }

        const chunksToWrite = []
        for (let chunk of contentChunks) {
            let embeddedChunk

            if (chunk.length > 20) {
                if (contentType === 'markdown') {
                    embeddedChunk = await embedTextFunction(
                        pageTitle + removeMarkdown(chunk),
                    )
                } else {
                    embeddedChunk = await embedTextFunction(pageTitle + chunk)
                }
                const vectors = embeddedChunk[0].data

                console.log('vectors', sourceApplication)

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

                chunksToWrite.push(documentToIndex)
            }
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

export { indexDocument }
