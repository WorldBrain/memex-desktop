const fs = require('fs')
const moment = require('moment')
const { indexDocument } = require('./index.js')

async function processMarkdown(
    file,
    type,
    allTables,
    pdfJS,
    embedTextFunction,
) {
    const sourcesDB = allTables.sourcesDB

    // get base information of PDF
    const markdownFileData = fs.readFileSync(file)

    // define the title by it's filename
    const path = require('path')
    const title = path.basename(file, path.extname(file))

    // get the markdown text
    const markdown = fs.readFileSync(file, 'utf-8')

    // get the file creation date
    const stats = fs.statSync(file)
    console.log('stats', stats)
    const createdWhen = moment(stats.birthtime).valueOf()

    // SourceApplication
    let sourceApplication

    if (type === 'logseq') {
        sourceApplication = 'logseq'
    } else if (type === 'obsidian') {
        sourceApplication = 'obsidian'
    }

    // save the document to the sourcesDB markdownDocsTable

    await allTables.sourcesDB.run(
        `INSERT OR REPLACE INTO markdownDocsTable VALUES (NULL, ?, ?, ?, 'localMarkdown', ?, ?, ?)`,
        [file, title, markdown, sourceApplication, createdWhen, '1', ''],
    )

    // chunk it up by using any double \n as the delimiter, except when the previous item was a headline, then includ it
    // also include the last headline in every chunk until a new headline is found
    const chunks = markdown.split('\n\n')
    let chunkedMarkdown = []
    let lastHeadline = ''

    chunks.forEach((chunk) => {
        if (chunk.startsWith('#')) {
            lastHeadline = chunk
        }
        chunkedMarkdown.push(lastHeadline + '\n' + chunk)
    })

    // if the document is already in the database, remove all vectors and reindex the entire document

    // if it is a content change, search for the path bc that is tracked+

    // if it is a name change it will be booked as deletion and re-adding which means a new file
    // in this case compare the content - unfortunately we can only hash it and compare the hash

    // what happens if there

    // logseq

    // await allTables.vectorDocsTable.delete(
    //     `fullurl = '${fingerPrint.fingerPrint.toString()}'`,
    // )

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
    // )
    // console.log('PDF saved to Sqlite DB', documentToSave.fullurl)

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
    // })
    // console.log('PDF indexed in Vector DB', documentToSave.fullurl)

    // return documentToSave
}

module.exports = { processMarkdown }
