import { Request, Response } from 'express'
import log from 'electron-log'

interface AllTables {
    vectorDocsTable: any
    sourcesDB: any
}

interface Item {
    fullurl: string
    contenttype: string
    _distance: number
    pagetitle: string
    contenttext: string
    createdwhen: number
    sourceApplication: string
    creatorid: string
    entities: string[]
    path?: string
}

async function findSimilar(
    req: Request,
    res: Response,
    embedTextFunction: Function,
    allTables: AllTables,
    entityExtractionFunction: Function,
): Promise<Response> {
    try {
        const embeddedChunk = await embedTextFunction(req.body.contentText)
        const vectors = embeddedChunk[0].data

        const vectorDocsTable = allTables.vectorDocsTable

        let result: Item[] = await vectorDocsTable
            .search(Array.from(vectors))
            .where(`fullurl != '${req.body.fullUrl}' AND createdwhen != 0`)
            .limit(30)
            .execute()

        let filteredResult: Item[] = result.filter((item: Item) => {
            if (item.contenttype === 'annotation') {
                var splitUrl = item.fullurl?.split('/#')
                if (splitUrl[0] === req.body.fullUrl) {
                    return false
                }
            }
            return item._distance < 1.25 && item.fullurl !== 'null'
        })

        filteredResult = Object.values(
            filteredResult.reduce((acc: Record<string, Item>, item: Item) => {
                if (
                    !acc[item.fullurl] ||
                    acc[item.fullurl]._distance > item._distance
                ) {
                    acc[item.fullurl] = item
                }
                return acc
            }, {}),
        )

        const endResults = await Promise.all(
            filteredResult.map(async function (item: Item) {
                let path
                if (item.contenttype === 'pdf') {
                    path = await allTables.sourcesDB.get(
                        `SELECT path FROM pdfTable WHERE fingerPrint = ?`,
                        [item.fullurl],
                    )
                }

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
                    path: path.path,
                }
            }),
        )

        return res.status(200).send(endResults)
    } catch (error) {
        log.error('Error in /find_similar', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

export { findSimilar }
