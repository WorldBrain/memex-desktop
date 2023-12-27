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
import { splitContentInReasonableChunks } from './utils.js'
import log from 'electron-log'
import TurndownService from 'turndown'
import removeMarkdown from 'remove-markdown'
function indexDocument(_a) {
    var fullUrl = _a.fullUrl,
        pageTitle = _a.pageTitle,
        fullHTML = _a.fullHTML,
        createdWhen = _a.createdWhen,
        contentType = _a.contentType,
        sourceApplication = _a.sourceApplication,
        creatorId = _a.creatorId,
        embedTextFunction = _a.embedTextFunction,
        allTables = _a.allTables,
        entityExtractionFunction = _a.entityExtractionFunction
    return __awaiter(this, void 0, void 0, function () {
        var fullHTMLParsed,
            contentChunks,
            turndownService,
            response,
            error_1,
            chunksToWrite,
            _i,
            contentChunks_1,
            chunk,
            embeddedChunk,
            vectors,
            documentToIndex,
            vectorDocsTable,
            error_2
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    fullHTMLParsed = null
                    _b.label = 1
                case 1:
                    _b.trys.push([1, 23, , 24])
                    contentChunks = []
                    if (!(contentType === 'annotation')) return [3 /*break*/, 2]
                    turndownService = new TurndownService()
                    contentChunks = [
                        turndownService.turndown(
                            Array.isArray(fullHTML)
                                ? fullHTML.join(' ')
                                : fullHTML,
                        ),
                    ]
                    return [3 /*break*/, 11]
                case 2:
                    if (!(contentType === 'pdf')) return [3 /*break*/, 3]
                    if (typeof fullHTML === 'string') {
                        fullHTMLParsed = JSON.parse(fullHTML)
                        contentChunks = fullHTMLParsed.map(function (item) {
                            return Object.values(item)[0]
                        })
                    }
                    return [3 /*break*/, 11]
                case 3:
                    if (!(contentType === 'markdown')) return [3 /*break*/, 4]
                    contentChunks = Array.isArray(fullHTML)
                        ? fullHTML
                        : [fullHTML || '']
                    return [3 /*break*/, 11]
                case 4:
                    if (!!fullHTML) return [3 /*break*/, 9]
                    _b.label = 5
                case 5:
                    _b.trys.push([5, 8, , 9])
                    return [4 /*yield*/, fetch(fullUrl)]
                case 6:
                    response = _b.sent()
                    return [4 /*yield*/, response.text()]
                case 7:
                    fullHTML = _b.sent()
                    return [3 /*break*/, 9]
                case 8:
                    error_1 = _b.sent()
                    console.error(error_1)
                    return [3 /*break*/, 9]
                case 9:
                    return [
                        4 /*yield*/,
                        splitContentInReasonableChunks(
                            Array.isArray(fullHTML)
                                ? fullHTML.join(' ')
                                : fullHTML,
                        ),
                    ]
                case 10:
                    contentChunks = _b.sent()
                    _b.label = 11
                case 11:
                    if (contentChunks.length === 0) {
                        return [2 /*return*/, false]
                    }
                    chunksToWrite = []
                    ;(_i = 0), (contentChunks_1 = contentChunks)
                    _b.label = 12
                case 12:
                    if (!(_i < contentChunks_1.length)) return [3 /*break*/, 18]
                    chunk = contentChunks_1[_i]
                    embeddedChunk = void 0
                    if (!(chunk.length > 20)) return [3 /*break*/, 17]
                    if (!(contentType === 'markdown')) return [3 /*break*/, 14]
                    return [
                        4 /*yield*/,
                        embedTextFunction(pageTitle + removeMarkdown(chunk)),
                    ]
                case 13:
                    embeddedChunk = _b.sent()
                    return [3 /*break*/, 16]
                case 14:
                    return [4 /*yield*/, embedTextFunction(pageTitle + chunk)]
                case 15:
                    embeddedChunk = _b.sent()
                    _b.label = 16
                case 16:
                    vectors = embeddedChunk[0].data
                    console.log('vectors', sourceApplication)
                    documentToIndex = {
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
                    _b.label = 17
                case 17:
                    _i++
                    return [3 /*break*/, 12]
                case 18:
                    vectorDocsTable = allTables.vectorDocsTable
                    if (!vectorDocsTable) return [3 /*break*/, 22]
                    return [4 /*yield*/, vectorDocsTable.add(chunksToWrite)]
                case 19:
                    _b.sent()
                    return [
                        4 /*yield*/,
                        new Promise(function (resolve) {
                            return setTimeout(resolve, 100)
                        }),
                    ]
                case 20:
                    _b.sent()
                    return [4 /*yield*/, vectorDocsTable.cleanupOldVersions(1)]
                case 21:
                    _b.sent()
                    _b.label = 22
                case 22:
                    console.log('Successfully indexed: ', fullUrl)
                    log.log('Successfully indexed: ', fullUrl)
                    return [2 /*return*/, true]
                case 23:
                    error_2 = _b.sent()
                    console.log('Failure indexing: ', fullUrl, ' ', error_2)
                    log.log('Failure indexed: ', fullUrl, ' ', error_2)
                    return [2 /*return*/, false]
                case 24:
                    return [2 /*return*/]
            }
        })
    })
}
export { indexDocument }
//# sourceMappingURL=index.js.map
