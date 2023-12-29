import fs from 'fs'
import moment from 'moment'
import path from 'path'
import { indexDocument } from './index.js'
import crypto from 'crypto'

interface AllTables {
    sourcesDB: any
    vectorDocsTable: any
}

async function processMarkdown(
    file: string,
    allTables: AllTables,
    embedTextFunction: (text: string) => Promise<any>,
    sourceApplication: string,
    changeType: 'addOrRename' | 'contentChange',
): Promise<void> {
    const sourcesDB = allTables.sourcesDB

    // check if the file has already been indexed, and if so skip it
    const existingFile = await sourcesDB.get(
        `SELECT * FROM markdownDocsTable WHERE path = ?`,
        [file],
    )
    if (existingFile && changeType === 'addOrRename') {
        return
    }

    // define the title by it's filename
    const title = path.basename(file, path.extname(file))

    // get the markdown text
    const markdown = fs.readFileSync(file, 'utf-8')

    if (markdown.length === 0) {
        return
    }

    // hash the markdown file to get the fingerprint
    const fingerPrint = crypto.createHash('md5').update(markdown).digest('hex')

    // get the file creation date
    const stats = fs.statSync(file)
    const createdWhen = moment(stats.birthtime).valueOf()

    // if title change, compare by fingerprint

    if (changeType === 'addOrRename') {
        // check if the document is already in the database
        try {
            const existingFileViaFingerPrint = await sourcesDB.get(
                `SELECT * FROM markdownDocsTable WHERE fingerPrint = ?`,
                [fingerPrint],
            )

            // this means it was just the setup listener
            if (existingFileViaFingerPrint?.path === file) {
                return
            }
            // determine if the change is just rename or if its a new file
            if (existingFileViaFingerPrint) {
                const existingFilePath =
                    existingFileViaFingerPrint.path.substring(
                        0,
                        existingFileViaFingerPrint.path.lastIndexOf('/'),
                    )
                const newFilePath = file.substring(0, file.lastIndexOf('/'))

                if (existingFilePath === newFilePath) {
                    // if it is a rename, update the path
                    await allTables.sourcesDB.run(
                        `UPDATE markdownDocsTable SET path = ? WHERE fingerPrint = ?`,
                        [file, fingerPrint],
                    )
                }

                // TODO: if a rename it means we have to either update all the vectors with the new path or delete the old vectors and reindex the entire document
                console.log('delete vectors')
                await allTables.vectorDocsTable.delete(
                    `fullurl = '${fingerPrint}'`,
                )
            } else {
                // TODO: if a new file, index the entire document
                await allTables?.sourcesDB?.run(
                    `INSERT INTO markdownDocsTable VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        file,
                        fingerPrint,
                        title,
                        markdown,
                        sourceApplication,
                        createdWhen,
                        '1',
                        '',
                    ],
                )
            }
        } catch (error) {
            throw error
        }
        const chunkedMarkdown = await chunkMarkdown(markdown)

        console.log('sourceApplication', sourceApplication)

        await indexDocument({
            fullUrl: fingerPrint,
            pageTitle: title,
            fullHTML: chunkedMarkdown,
            createdWhen: createdWhen,
            contentType: 'markdown',
            sourceApplication: sourceApplication,
            creatorId: '1',
            embedTextFunction: embedTextFunction,
            allTables: allTables,
            entityExtractionFunction: null,
        })
    }

    // if content change compare by path

    if (changeType === 'contentChange') {
        // check if the document is already in the database
        const existingFileViaPath = await sourcesDB.get(
            `SELECT fingerPrint FROM markdownDocsTable WHERE path = ?`,
            [file],
        )

        // make sure the file exists before changing the content
        if (existingFileViaPath) {
            await allTables.sourcesDB.run(
                `UPDATE markdownDocsTable SET content = ? , fingerPrint = ? WHERE path = ?`,
                [markdown, fingerPrint, file],
            )

            // TODO: if the content changes we have to delete all the vectors of this document and re-index the entire document. We have to debounce this somehow beca
            await allTables.vectorDocsTable.delete(
                `fullurl = '${existingFileViaPath.fingerPrint}'`,
            )

            const chunkedMarkdown = await chunkMarkdown(markdown)

            await indexDocument({
                fullUrl: fingerPrint,
                pageTitle: title,
                fullHTML: chunkedMarkdown,
                createdWhen: createdWhen,
                contentType: 'markdown',
                sourceApplication: sourceApplication,
                creatorId: '1',
                embedTextFunction: embedTextFunction,
                allTables: allTables,
                entityExtractionFunction: null,
            })
        }
    }

    //

    //
    // if the document is already in the database, remove all vectors and reindex the entire document

    // if it is a content change, search for the path bc that is tracked+

    // if it is a name change it will be booked as deletion and re-adding which means a new file
    // in this case compare the content - unfortunately we can only hash it and compare the hash

    // what happens if there

    // logseq

    // await allTables.vectorDocsTable.delete(
    //     `fullurl = '${fingerPrint.fingerPrint.toString()}'`,
    // );

    // const documentToSave = {
    //     path: file || '',
    //     fullurl: fingerPrint || '',
    //     pagetitle: title || '',
    //     sourceapplication: 'localPDF' || '',
    //     createdwhen: createdWhen || Date.now(),
    //     creatorid: '1' || '',
    //     contenttype: 'pdf' || '',
    //     contenttext: JSON.stringify(pdfText) || '',
    // }

    // await allTables.sourcesDB.run(
    //     `INSERT INTO pdfTable VALUES(null, ?, ?, ? ,?, ?, ?, ?)`,
    //     [
    //         documentToSave.path,
    //         documentToSave.fullurl,
    //         documentToSave.pagetitle,
    //         documentToSave.contenttext,
    //         documentToSave.createdwhen,
    //         documentToSave.sourceapplication,
    //         documentToSave.creatorid,
    //     ],
    // );
    // console.log('PDF saved to Sqlite DB', documentToSave.fullurl);

    // await indexDocument({
    //     fullUrlInput: documentToSave.fullurl,
    //     pageTitleInput: documentToSave.pagetitle,
    //     fullHTMLInput: documentToSave.contenttext,
    //     createdWhenInput: documentToSave.createdwhen,
    //     contentTypeInput: documentToSave.contenttype,
    //     sourceApplicationInput: documentToSave.sourceapplication,
    //     creatorIdInput: documentToSave.creatorid,
    //     embedTextFunction: embedTextFunction,
    //     allTables: allTables,
    //     entityExtractionFunction: null,
    // });
    // console.log('PDF indexed in Vector DB', documentToSave.fullurl);

    // return documentToSave;
}

export { processMarkdown }

export async function chunkMarkdown(markdown: string) {
    // chunk it up by using any double \n as the delimiter, except when the previous item was a headline, then include it
    // also include the last headline in every chunk until a new headline is found
    const chunks = markdown.split('\n\n')
    let chunkedMarkdown: string[] = []
    let lastHeadline = ''

    chunks.forEach((chunk) => {
        if (chunk.startsWith('#')) {
            lastHeadline = chunk
        }

        // Clean the chunk by converting markdown to text

        chunkedMarkdown.push(lastHeadline + '\n' + chunk)
    })

    return chunkedMarkdown
}
