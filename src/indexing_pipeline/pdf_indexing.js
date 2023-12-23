const fs = require('fs')
const moment = require('moment')
const { indexDocument } = require('./index.js')

async function processPDF(file, allTables, pdfJS, embedTextFunction) {
    const sourcesDB = allTables.sourcesDB
    const existingPDF = await sourcesDB.get(
        `SELECT * FROM pdfTable WHERE path = ?`,
        [file],
    )
    if (existingPDF === undefined) {
        // get base information of PDF
        const pdfData = fs.readFileSync(file)
        const uint8Array = new Uint8Array(pdfData.buffer)
        const pdfDoc = await pdfJS.getDocument({ data: uint8Array }).promise
        const fingerPrint = pdfDoc._pdfInfo.fingerprints[0]

        //Find the entry with the fingerprint so we can update it or write a new entry
        const existingFileViaFingerPrint = await sourcesDB.get(
            `SELECT * FROM pdfTable WHERE fingerPrint = ?`,
            [fingerPrint],
        )

        // determine if the change is just rename or if its a new file
        if (existingFileViaFingerPrint) {
            const existingFilePath = existingFileViaFingerPrint.path.substring(
                0,
                existingFileViaFingerPrint.path.lastIndexOf('/'),
            )
            const newFilePath = file.substring(0, file.lastIndexOf('/'))

            if (existingFilePath === newFilePath) {
                await allTables.sourcesDB.run(
                    `UPDATE pdfTable SET path = ? WHERE fingerPrint = ?`,
                    [file, fingerPrint],
                )
            }
            if (existingFileViaFingerPrint.path === file) {
                console.log('PDF already indexed')
            }
            return
        }

        // Grab Metadata
        const metaData = await pdfDoc.getMetadata()
        let createdWhen = metaData.info.CreationDate || null

        try {
            createdWhen = moment(createdWhen).unix()
        } catch (error) {
            createdWhen = Date.now()
        }
        // get title if available
        let title = metaData.info.Title || null

        // Get all text elements > is a JSON Array
        let textSections = []
        async function getText() {
            var pdf = pdfDoc
            var maxPages = pdf._pdfInfo.numPages
            // get all pages text
            for (var j = 1; j <= maxPages; j++) {
                var page = await pdf.getPage(j)
                var textContent = await page.getTextContent()

                // remove all vertical text
                textContent.items = textContent.items.filter(
                    (item) => item.transform[2] >= 0,
                )

                textSections = [...textSections, ...textContent.items]
            }
        }

        await getText()
        // Parse text elements into paragraphs and headings
        let pdfText = []

        // sort text elements by font size to chunk later
        let heightCounts = {}
        textSections.forEach((textSegment) => {
            let height = textSegment.transform[0]
            if (heightCounts[height]) {
                heightCounts[height]++
            } else {
                heightCounts[height] = 1
            }
        })

        let sortedHeights = Object.keys(heightCounts).sort(
            (a, b) => heightCounts[b] - heightCounts[a],
        )

        let paragraphHeight = sortedHeights[0]
        let headingHeights = sortedHeights.slice(1)

        headingHeights.sort((a, b) => b - a)

        let textElements = {}
        // find the most common font size, this is the standard text size
        textElements[paragraphHeight] = 'Paragraph'

        // make the rest headings in ascending order
        headingHeights.forEach((height, index) => {
            if (height < paragraphHeight) {
                textElements[height] = 'SmallText' + (index + 1)
            } else {
                textElements[height] = 'Heading' + (index + 1)
            }
        })

        // Organise all elements into paragraphs and headings
        let tempGroup = ''

        for (let i = 0; i < textSections?.length; i++) {
            const textSegment = textSections[i]
            let matchingTextElement
            if (
                // When items stop having the same font-Size, it's likely a new section or heading
                (textSegment?.transform[0] ===
                    textSections[i - 1]?.transform[0] ||
                    textSegment?.transform[0] <= paragraphHeight) &&
                textSegment.str !== ''
            ) {
                if (
                    textSegment.hasEOL ||
                    textSections[i - 1]?.transform[5] !==
                        textSegment.transform[5]
                ) {
                    tempGroup += textSegment.str + ' '
                } else {
                    tempGroup += textSegment.str
                }
            } else if (i === textSections?.length - 1 && tempGroup.length > 0) {
                matchingTextElement =
                    textElements[textSections[i]?.transform[0]]
                pdfText.push({
                    [matchingTextElement]: tempGroup,
                })
            } else {
                if (textSections[i - 1]?.transform[0] == null) {
                    matchingTextElement =
                        textElements[textSections[i]?.transform[0]]
                } else {
                    matchingTextElement =
                        textElements[textSections[i - 1]?.transform[0]]
                }

                // filter out small chunks that are likely noise
                if (tempGroup.length > 10) {
                    pdfText.push({
                        [matchingTextElement]: tempGroup.replace(
                            /(?<!\s)-\s/g,
                            '',
                        ),
                    })
                }

                if (textSegment.height !== 0) {
                    if (
                        textSegment.hasEOL ||
                        textSections[i - 1]?.transform[5] !==
                            textSegment.transform[5]
                    ) {
                        tempGroup = textSegment.str + ' '
                    } else {
                        tempGroup = textSegment.str
                    }
                } else {
                    tempGroup = ''
                }
            }
        }

        // get title if not available from metadata, take the tallest heading in the first 5 pulled items

        if (!title) {
            const firstFiveItems = pdfText.slice(0, 5)
            let lowestHeading = 10
            firstFiveItems.forEach((item) => {
                const keys = Object.keys(item)
                keys.forEach((key) => {
                    if (key.startsWith('Heading')) {
                        const headingNumber = parseInt(
                            key.replace('Heading', ''),
                        )
                        if (headingNumber < lowestHeading) {
                            lowestHeading = headingNumber
                        }
                    }
                })
            })
            let itemWithHeading2 = firstFiveItems.find(
                (item) => 'Heading2' in item,
            )
            title = itemWithHeading2 ? itemWithHeading2['Heading2'] : null

            if (!title && pdfText.length > 0) {
                const firstItem = pdfText[0]
                const firstKey = Object.keys(firstItem)[0]
                title = firstItem[firstKey]
            }
        }

        const documentToSave = {
            path: file || '',
            fullurl: fingerPrint || '',
            pagetitle: title || '',
            sourceapplication: 'localPDF' || '',
            createdwhen: createdWhen || Date.now(),
            creatorid: '1' || '',
            contenttype: 'pdf' || '',
            contenttext: JSON.stringify(pdfText) || '',
        }

        await allTables.sourcesDB.run(
            `INSERT INTO pdfTable VALUES(null, ?, ?, ? ,?, ?, ?, ?)`,
            [
                documentToSave.path,
                documentToSave.fullurl,
                documentToSave.pagetitle,
                documentToSave.contenttext,
                documentToSave.createdwhen,
                documentToSave.sourceapplication,
                documentToSave.creatorid,
            ],
        )
        console.log('PDF saved to Sqlite DB', documentToSave.fullurl)

        await indexDocument({
            fullUrlInput: documentToSave.fullurl,
            pageTitleInput: documentToSave.pagetitle,
            fullHTMLInput: documentToSave.contenttext,
            createdWhenInput: documentToSave.createdwhen,
            contentTypeInput: documentToSave.contenttype,
            sourceApplicationInput: documentToSave.sourceapplication,
            creatorIdInput: documentToSave.creatorid,
            embedTextFunction: embedTextFunction,
            allTables: allTables,
            entityExtractionFunction: null,
        })
        console.log('PDF indexed in Vector DB', documentToSave.fullurl)

        return documentToSave
    } else {
        return
    }
}

module.exports = { processPDF }
