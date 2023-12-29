var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import fs from 'fs';
import moment from 'moment';
import { indexDocument } from './index.js';
function processPDF(file, allTables, pdfJS, embedTextFunction) {
    var _a, _b, _c, _d, _e, _f, _g;
    return __awaiter(this, void 0, void 0, function () {
        var sourcesDB, existingPDF, pdfData, uint8Array, pdfDoc_1, fingerPrint, existingFileViaFingerPrint, existingFilePath, newFilePath, metaData, createdWhen, title, textSections_1, getText, pdfText, heightCounts_1, sortedHeights, paragraphHeight_1, headingHeights, textElements_1, tempGroup, i, textSegment, matchingTextElement, firstFiveItems, lowestHeading_1, itemWithHeading2, firstItem, firstKey, documentToSave;
        var _h, _j;
        var _this = this;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    sourcesDB = allTables.sourcesDB;
                    return [4 /*yield*/, sourcesDB.get("SELECT * FROM pdfTable WHERE path = ?", [file])];
                case 1:
                    existingPDF = _k.sent();
                    if (!(existingPDF === undefined)) return [3 /*break*/, 11];
                    pdfData = fs.readFileSync(file);
                    uint8Array = new Uint8Array(pdfData.buffer);
                    return [4 /*yield*/, pdfJS.getDocument({ data: uint8Array }).promise];
                case 2:
                    pdfDoc_1 = _k.sent();
                    fingerPrint = pdfDoc_1._pdfInfo.fingerprints[0];
                    return [4 /*yield*/, sourcesDB.get("SELECT * FROM pdfTable WHERE fingerPrint = ?", [fingerPrint])
                        // determine if the change is just rename or if its a new file
                    ];
                case 3:
                    existingFileViaFingerPrint = _k.sent();
                    if (!existingFileViaFingerPrint) return [3 /*break*/, 6];
                    existingFilePath = existingFileViaFingerPrint.path.substring(0, existingFileViaFingerPrint.path.lastIndexOf('/'));
                    newFilePath = file.substring(0, file.lastIndexOf('/'));
                    if (!(existingFilePath === newFilePath)) return [3 /*break*/, 5];
                    return [4 /*yield*/, allTables.sourcesDB.run("UPDATE pdfTable SET path = ? WHERE fingerPrint = ?", [file, fingerPrint])];
                case 4:
                    _k.sent();
                    _k.label = 5;
                case 5:
                    if (existingFileViaFingerPrint.path === file) {
                        console.log('PDF already indexed');
                    }
                    return [2 /*return*/];
                case 6: return [4 /*yield*/, pdfDoc_1.getMetadata()];
                case 7:
                    metaData = _k.sent();
                    createdWhen = metaData.info.CreationDate || null;
                    try {
                        createdWhen = moment(createdWhen).unix();
                    }
                    catch (error) {
                        createdWhen = Date.now();
                    }
                    title = metaData.info.Title || null;
                    textSections_1 = [];
                    getText = function () { return __awaiter(_this, void 0, void 0, function () {
                        var pdf, maxPages, j, page, textContent;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    pdf = pdfDoc_1;
                                    maxPages = pdf._pdfInfo.numPages;
                                    j = 1;
                                    _a.label = 1;
                                case 1:
                                    if (!(j <= maxPages)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, pdf.getPage(j)];
                                case 2:
                                    page = _a.sent();
                                    return [4 /*yield*/, page.getTextContent()
                                        // remove all vertical text
                                    ];
                                case 3:
                                    textContent = _a.sent();
                                    // remove all vertical text
                                    textContent.items = textContent.items.filter(function (item) { return item.transform[2] >= 0; });
                                    textSections_1 = __spreadArray(__spreadArray([], textSections_1, true), textContent.items, true);
                                    _a.label = 4;
                                case 4:
                                    j++;
                                    return [3 /*break*/, 1];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, getText()
                        // Parse text elements into paragraphs and headings
                    ];
                case 8:
                    _k.sent();
                    pdfText = [];
                    heightCounts_1 = {};
                    textSections_1.forEach(function (textSegment) {
                        var height = textSegment.transform[0];
                        if (heightCounts_1[height]) {
                            heightCounts_1[height]++;
                        }
                        else {
                            heightCounts_1[height] = 1;
                        }
                    });
                    sortedHeights = Object.keys(heightCounts_1)
                        .map(Number)
                        .sort(function (a, b) { return heightCounts_1[b] - heightCounts_1[a]; });
                    paragraphHeight_1 = sortedHeights[0];
                    headingHeights = sortedHeights.slice(1);
                    headingHeights.sort(function (a, b) { return Number(b) - Number(a); });
                    textElements_1 = {};
                    // find the most common font size, this is the standard text size
                    textElements_1[paragraphHeight_1] = 'Paragraph';
                    // make the rest headings in ascending order
                    headingHeights.forEach(function (height, index) {
                        if (height < paragraphHeight_1) {
                            textElements_1[height] = 'SmallText' + (index + 1);
                        }
                        else {
                            textElements_1[height] = 'Heading' + (index + 1);
                        }
                    });
                    tempGroup = '';
                    for (i = 0; i < (textSections_1 === null || textSections_1 === void 0 ? void 0 : textSections_1.length); i++) {
                        textSegment = textSections_1[i];
                        matchingTextElement = void 0;
                        if ((textSegment === null || textSegment === void 0 ? void 0 : textSegment.transform[0]) ===
                            ((_a = textSections_1[i - 1]) === null || _a === void 0 ? void 0 : _a.transform[0]) ||
                            (typeof (textSegment === null || textSegment === void 0 ? void 0 : textSegment.transform[0]) === 'number' &&
                                (textSegment === null || textSegment === void 0 ? void 0 : textSegment.transform[0]) <= paragraphHeight_1 &&
                                textSegment.str !== '')) {
                            if (textSegment.hasEOL ||
                                ((_b = textSections_1[i - 1]) === null || _b === void 0 ? void 0 : _b.transform[5]) !==
                                    textSegment.transform[5]) {
                                tempGroup += textSegment.str + ' ';
                            }
                            else {
                                tempGroup += textSegment.str;
                            }
                        }
                        else if (i === (textSections_1 === null || textSections_1 === void 0 ? void 0 : textSections_1.length) - 1 && tempGroup.length > 0) {
                            matchingTextElement =
                                textElements_1[(_c = textSections_1[i]) === null || _c === void 0 ? void 0 : _c.transform[0]];
                            pdfText.push((_h = {},
                                _h[matchingTextElement] = tempGroup,
                                _h));
                        }
                        else {
                            if (((_d = textSections_1[i - 1]) === null || _d === void 0 ? void 0 : _d.transform[0]) == null) {
                                matchingTextElement =
                                    textElements_1[(_e = textSections_1[i]) === null || _e === void 0 ? void 0 : _e.transform[0]];
                            }
                            else {
                                matchingTextElement =
                                    textElements_1[(_f = textSections_1[i - 1]) === null || _f === void 0 ? void 0 : _f.transform[0]];
                            }
                            // filter out small chunks that are likely noise
                            if (tempGroup.length > 10) {
                                pdfText.push((_j = {},
                                    _j[matchingTextElement] = tempGroup.replace(/(?<!\s)-\s/g, ''),
                                    _j));
                            }
                            if (textSegment.height !== 0) {
                                if (textSegment.hasEOL ||
                                    ((_g = textSections_1[i - 1]) === null || _g === void 0 ? void 0 : _g.transform[5]) !==
                                        textSegment.transform[5]) {
                                    tempGroup = textSegment.str + ' ';
                                }
                                else {
                                    tempGroup = textSegment.str;
                                }
                            }
                            else {
                                tempGroup = '';
                            }
                        }
                    }
                    // get title if not available from metadata, take the tallest heading in the first 5 pulled items
                    if (!title) {
                        firstFiveItems = pdfText.slice(0, 5);
                        lowestHeading_1 = 10;
                        firstFiveItems.forEach(function (item) {
                            var keys = Object.keys(item);
                            keys.forEach(function (key) {
                                if (key.startsWith('Heading')) {
                                    var headingNumber = parseInt(key.replace('Heading', ''));
                                    if (headingNumber < lowestHeading_1) {
                                        lowestHeading_1 = headingNumber;
                                    }
                                }
                            });
                        });
                        itemWithHeading2 = firstFiveItems.find(function (item) { return 'Heading2' in item; });
                        title = itemWithHeading2 ? itemWithHeading2['Heading2'] : null;
                        if (!title && pdfText.length > 0) {
                            firstItem = pdfText[0];
                            firstKey = Object.keys(firstItem)[0];
                            title = firstItem[firstKey];
                        }
                    }
                    documentToSave = {
                        path: file || '',
                        fullurl: fingerPrint || '',
                        pagetitle: title || '',
                        sourceapplication: 'localPDF' || '',
                        createdwhen: createdWhen || Date.now(),
                        creatorid: '1' || '',
                        contenttype: 'pdf' || '',
                        contenttext: JSON.stringify(pdfText) || ''
                    };
                    return [4 /*yield*/, allTables.sourcesDB.run("INSERT INTO pdfTable VALUES(null, ?, ?, ? ,?, ?, ?, ?, ?)", [
                            documentToSave.path,
                            documentToSave.fullurl,
                            documentToSave.pagetitle,
                            documentToSave.contenttext,
                            documentToSave.createdwhen,
                            documentToSave.sourceapplication,
                            documentToSave.creatorid,
                            '',
                        ])];
                case 9:
                    _k.sent();
                    console.log('PDF saved to Sqlite DB', documentToSave.fullurl);
                    return [4 /*yield*/, indexDocument({
                            fullUrl: documentToSave.fullurl,
                            pageTitle: documentToSave.pagetitle,
                            fullHTML: documentToSave.contenttext,
                            createdWhen: documentToSave.createdwhen,
                            contentType: documentToSave.contenttype,
                            sourceApplication: documentToSave.sourceapplication,
                            creatorId: documentToSave.creatorid,
                            embedTextFunction: embedTextFunction,
                            allTables: allTables,
                            entityExtractionFunction: null
                        })];
                case 10:
                    _k.sent();
                    console.log('PDF indexed in Vector DB', documentToSave.fullurl);
                    return [2 /*return*/, documentToSave];
                case 11: return [2 /*return*/];
            }
        });
    });
}
export { processPDF };
//# sourceMappingURL=pdf_indexing.js.map