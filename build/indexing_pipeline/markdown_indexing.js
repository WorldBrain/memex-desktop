var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value)
                  })
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value))
                } catch (e) {
                    reject(e)
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value))
                } catch (e) {
                    reject(e)
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected)
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next(),
            )
        })
    }
var __generator =
    (this && this.__generator) ||
    function (thisArg, body) {
        var _ = {
                label: 0,
                sent: function () {
                    if (t[0] & 1) throw t[1]
                    return t[1]
                },
                trys: [],
                ops: [],
            },
            f,
            y,
            t,
            g
        return (
            (g = { next: verb(0), throw: verb(1), return: verb(2) }),
            typeof Symbol === 'function' &&
                (g[Symbol.iterator] = function () {
                    return this
                }),
            g
        )
        function verb(n) {
            return function (v) {
                return step([n, v])
            }
        }
        function step(op) {
            if (f) throw new TypeError('Generator is already executing.')
            while ((g && ((g = 0), op[0] && (_ = 0)), _))
                try {
                    if (
                        ((f = 1),
                        y &&
                            (t =
                                op[0] & 2
                                    ? y['return']
                                    : op[0]
                                      ? y['throw'] ||
                                        ((t = y['return']) && t.call(y), 0)
                                      : y.next) &&
                            !(t = t.call(y, op[1])).done)
                    )
                        return t
                    if (((y = 0), t)) op = [op[0] & 2, t.value]
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op
                            break
                        case 4:
                            _.label++
                            return { value: op[1], done: false }
                        case 5:
                            _.label++
                            y = op[1]
                            op = [0]
                            continue
                        case 7:
                            op = _.ops.pop()
                            _.trys.pop()
                            continue
                        default:
                            if (
                                !((t = _.trys),
                                (t = t.length > 0 && t[t.length - 1])) &&
                                (op[0] === 6 || op[0] === 2)
                            ) {
                                _ = 0
                                continue
                            }
                            if (
                                op[0] === 3 &&
                                (!t || (op[1] > t[0] && op[1] < t[3]))
                            ) {
                                _.label = op[1]
                                break
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1]
                                t = op
                                break
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2]
                                _.ops.push(op)
                                break
                            }
                            if (t[2]) _.ops.pop()
                            _.trys.pop()
                            continue
                    }
                    op = body.call(thisArg, _)
                } catch (e) {
                    op = [6, e]
                    y = 0
                } finally {
                    f = t = 0
                }
            if (op[0] & 5) throw op[1]
            return { value: op[0] ? op[1] : void 0, done: true }
        }
    }
import fs from 'fs'
import moment from 'moment'
import path from 'path'
import { indexDocument } from './index.js'
import crypto from 'crypto'
function processMarkdown(
    file,
    allTables,
    embedTextFunction,
    sourceApplication,
    changeType,
) {
    var _a
    return __awaiter(this, void 0, void 0, function () {
        var sourcesDB,
            existingFile,
            title,
            markdown,
            fingerPrint,
            stats,
            createdWhen,
            existingFileViaFingerPrint,
            existingFilePath,
            newFilePath,
            error_1,
            chunkedMarkdown,
            existingFileViaPath,
            chunkedMarkdown
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    sourcesDB = allTables.sourcesDB
                    return [
                        4 /*yield*/,
                        sourcesDB.get(
                            'SELECT * FROM markdownDocsTable WHERE path = ?',
                            [file],
                        ),
                    ]
                case 1:
                    existingFile = _b.sent()
                    if (existingFile && changeType === 'addOrRename') {
                        return [2 /*return*/]
                    }
                    title = path.basename(file, path.extname(file))
                    markdown = fs.readFileSync(file, 'utf-8')
                    if (markdown.length === 0) {
                        return [2 /*return*/]
                    }
                    fingerPrint = crypto
                        .createHash('md5')
                        .update(markdown)
                        .digest('hex')
                    stats = fs.statSync(file)
                    createdWhen = moment(stats.birthtime).valueOf()
                    if (!(changeType === 'addOrRename'))
                        return [3 /*break*/, 14]
                    _b.label = 2
                case 2:
                    _b.trys.push([2, 10, , 11])
                    return [
                        4 /*yield*/,
                        sourcesDB.get(
                            'SELECT * FROM markdownDocsTable WHERE fingerPrint = ?',
                            [fingerPrint],
                        ),
                        // this means it was just the setup listener
                    ]
                case 3:
                    existingFileViaFingerPrint = _b.sent()
                    // this means it was just the setup listener
                    if (
                        (existingFileViaFingerPrint === null ||
                        existingFileViaFingerPrint === void 0
                            ? void 0
                            : existingFileViaFingerPrint.path) === file
                    ) {
                        return [2 /*return*/]
                    }
                    if (!existingFileViaFingerPrint) return [3 /*break*/, 7]
                    existingFilePath =
                        existingFileViaFingerPrint.path.substring(
                            0,
                            existingFileViaFingerPrint.path.lastIndexOf('/'),
                        )
                    newFilePath = file.substring(0, file.lastIndexOf('/'))
                    if (!(existingFilePath === newFilePath))
                        return [3 /*break*/, 5]
                    // if it is a rename, update the path
                    return [
                        4 /*yield*/,
                        allTables.sourcesDB.run(
                            'UPDATE markdownDocsTable SET path = ? WHERE fingerPrint = ?',
                            [file, fingerPrint],
                        ),
                    ]
                case 4:
                    // if it is a rename, update the path
                    _b.sent()
                    _b.label = 5
                case 5:
                    // TODO: if a rename it means we have to either update all the vectors with the new path or delete the old vectors and reindex the entire document
                    console.log('delete vectors')
                    return [
                        4 /*yield*/,
                        allTables.vectorDocsTable['delete'](
                            "fullurl = '".concat(fingerPrint, "'"),
                        ),
                    ]
                case 6:
                    _b.sent()
                    return [3 /*break*/, 9]
                case 7:
                    // TODO: if a new file, index the entire document
                    return [
                        4 /*yield*/,
                        (_a =
                            allTables === null || allTables === void 0
                                ? void 0
                                : allTables.sourcesDB) === null || _a === void 0
                            ? void 0
                            : _a.run(
                                  'INSERT INTO markdownDocsTable VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                              ),
                    ]
                case 8:
                    // TODO: if a new file, index the entire document
                    _b.sent()
                    _b.label = 9
                case 9:
                    return [3 /*break*/, 11]
                case 10:
                    error_1 = _b.sent()
                    throw error_1
                case 11:
                    return [4 /*yield*/, chunkMarkdown(markdown)]
                case 12:
                    chunkedMarkdown = _b.sent()
                    console.log('sourceApplication', sourceApplication)
                    return [
                        4 /*yield*/,
                        indexDocument({
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
                        }),
                    ]
                case 13:
                    _b.sent()
                    _b.label = 14
                case 14:
                    if (!(changeType === 'contentChange'))
                        return [3 /*break*/, 20]
                    return [
                        4 /*yield*/,
                        sourcesDB.get(
                            'SELECT fingerPrint FROM markdownDocsTable WHERE path = ?',
                            [file],
                        ),
                        // make sure the file exists before changing the content
                    ]
                case 15:
                    existingFileViaPath = _b.sent()
                    if (!existingFileViaPath) return [3 /*break*/, 20]
                    return [
                        4 /*yield*/,
                        allTables.sourcesDB.run(
                            'UPDATE markdownDocsTable SET content = ? , fingerPrint = ? WHERE path = ?',
                            [markdown, fingerPrint, file],
                        ),
                        // TODO: if the content changes we have to delete all the vectors of this document and re-index the entire document. We have to debounce this somehow beca
                    ]
                case 16:
                    _b.sent()
                    // TODO: if the content changes we have to delete all the vectors of this document and re-index the entire document. We have to debounce this somehow beca
                    return [
                        4 /*yield*/,
                        allTables.vectorDocsTable['delete'](
                            "fullurl = '".concat(
                                existingFileViaPath.fingerPrint,
                                "'",
                            ),
                        ),
                    ]
                case 17:
                    // TODO: if the content changes we have to delete all the vectors of this document and re-index the entire document. We have to debounce this somehow beca
                    _b.sent()
                    return [4 /*yield*/, chunkMarkdown(markdown)]
                case 18:
                    chunkedMarkdown = _b.sent()
                    return [
                        4 /*yield*/,
                        indexDocument({
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
                        }),
                    ]
                case 19:
                    _b.sent()
                    _b.label = 20
                case 20:
                    return [2 /*return*/]
            }
        })
    })
}
export { processMarkdown }
export function chunkMarkdown(markdown) {
    return __awaiter(this, void 0, void 0, function () {
        var chunks, chunkedMarkdown, lastHeadline
        return __generator(this, function (_a) {
            chunks = markdown.split('\n\n')
            chunkedMarkdown = []
            lastHeadline = ''
            chunks.forEach(function (chunk) {
                if (chunk.startsWith('#')) {
                    lastHeadline = chunk
                }
                // Clean the chunk by converting markdown to text
                chunkedMarkdown.push(lastHeadline + '\n' + chunk)
            })
            return [2 /*return*/, chunkedMarkdown]
        })
    })
}
//# sourceMappingURL=markdown_indexing.js.map
