import fs from 'fs'
import moment from 'moment'
import { indexDocument } from './index.js'

interface AllTables {
    sourcesDB: any
}

interface TextSegment {
    transform: number[]
    str: string
    hasEOL: boolean
    height: number
}

interface DocumentToSave {
    path: string
    fullurl: string
    pagetitle: string
    sourceapplication: string
    createdwhen: number
    creatorid: string
    contenttype: string
    contenttext: string
}

async function processPDF(
    file: string,
    allTables: AllTables,
    pdfJS: any,
    embedTextFunction: (text: string) => Promise<any>,
): Promise<DocumentToSave | void> {
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
        let textSections: TextSegment[] = []

        const getText = async () => {
            var pdf = pdfDoc
            var maxPages = pdf._pdfInfo.numPages
            // get all pages text
            for (var j = 1; j <= maxPages; j++) {
                var page = await pdf.getPage(j)
                var textContent = await page.getTextContent()

                // remove all vertical text
                textContent.items = textContent.items.filter(
                    (item: TextSegment) => item.transform[2] >= 0,
                )

                textSections = [...textSections, ...textContent.items]
            }
        }

        await getText()
        // Parse text elements into paragraphs and headings
        let pdfText = []

        // sort text elements by font size to chunk later
        let heightCounts: { [key: number]: number } = {}
        textSections.forEach((textSegment: TextSegment) => {
            let height: number = textSegment.transform[0]
            if (heightCounts[height]) {
                heightCounts[height]++
            } else {
                heightCounts[height] = 1
            }
        })

        let sortedHeights: number[] = Object.keys(heightCounts)
            .map(Number)
            .sort((a, b) => heightCounts[b] - heightCounts[a])

        let paragraphHeight: number = sortedHeights[0]
        let headingHeights: number[] = sortedHeights.slice(1)

        headingHeights.sort((a, b) => Number(b) - Number(a))

        let textElements: { [key: string]: string } = {}
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
                textSegment?.transform[0] ===
                    textSections[i - 1]?.transform[0] ||
                (typeof textSegment?.transform[0] === 'number' &&
                    textSegment?.transform[0] <= paragraphHeight &&
                    textSegment.str !== '')
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
            fullUrl: documentToSave.fullurl,
            pageTitle: documentToSave.pagetitle,
            fullHTML: documentToSave.contenttext,
            createdWhen: documentToSave.createdwhen,
            contentType: documentToSave.contenttype,
            sourceApplication: documentToSave.sourceapplication,
            creatorId: documentToSave.creatorid,
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

export { processPDF }
