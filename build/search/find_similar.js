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
import log from 'electron-log';
function findSimilar(req, res, embedTextFunction, allTables, entityExtractionFunction) {
    return __awaiter(this, void 0, void 0, function () {
        var embeddedChunk, vectors, vectorDocsTable, result, filteredResult, endResults, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, embedTextFunction(req.body.contentText)];
                case 1:
                    embeddedChunk = _a.sent();
                    vectors = embeddedChunk[0].data;
                    vectorDocsTable = allTables.vectorDocsTable;
                    return [4 /*yield*/, vectorDocsTable
                            .search(Array.from(vectors))
                            .where("fullurl != '".concat(req.body.fullUrl, "' AND createdwhen != 0"))
                            .limit(30)
                            .execute()];
                case 2:
                    result = _a.sent();
                    filteredResult = result.filter(function (item) {
                        var _a;
                        if (item.contenttype === 'annotation') {
                            var splitUrl = (_a = item.fullurl) === null || _a === void 0 ? void 0 : _a.split('/#');
                            if (splitUrl[0] === req.body.fullUrl) {
                                return false;
                            }
                        }
                        return item._distance < 1.25 && item.fullurl !== 'null';
                    });
                    filteredResult = Object.values(filteredResult.reduce(function (acc, item) {
                        if (!acc[item.fullurl] ||
                            acc[item.fullurl]._distance > item._distance) {
                            acc[item.fullurl] = item;
                        }
                        return acc;
                    }, {}));
                    return [4 /*yield*/, Promise.all(filteredResult.map(function (item) {
                            return __awaiter(this, void 0, void 0, function () {
                                var path, topLevelFolder;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(item.sourceapplication === 'obsidian' ||
                                                item.sourceapplication === 'logseq')) return [3 /*break*/, 2];
                                            return [4 /*yield*/, allTables.sourcesDB.get("SELECT path FROM watchedFoldersTable WHERE sourceApplication = ?", [item.sourceapplication])];
                                        case 1:
                                            topLevelFolder = _a.sent();
                                            topLevelFolder = topLevelFolder.path.split('/').pop();
                                            _a.label = 2;
                                        case 2:
                                            if (!(item.contenttype === 'pdf')) return [3 /*break*/, 4];
                                            return [4 /*yield*/, allTables.sourcesDB.get("SELECT path FROM pdfTable WHERE fingerPrint = ?", [item.fullurl])];
                                        case 3:
                                            path = _a.sent();
                                            _a.label = 4;
                                        case 4:
                                            if (!(item.contenttype === 'markdown')) return [3 /*break*/, 6];
                                            return [4 /*yield*/, allTables.sourcesDB.get("SELECT path FROM markdownDocsTable WHERE fingerPrint = ?", [item.fullurl])];
                                        case 5:
                                            path = _a.sent();
                                            _a.label = 6;
                                        case 6: return [2 /*return*/, {
                                                fullUrl: item.fullurl,
                                                pageTitle: item.pagetitle,
                                                contentText: item.contenttext,
                                                createdWhen: item.createdwhen,
                                                contentType: item.contenttype,
                                                sourceApplication: item.sourceapplication,
                                                creatorId: item.creatorid,
                                                distance: item._distance,
                                                entities: item.entities,
                                                path: path === null || path === void 0 ? void 0 : path.path,
                                                topLevelFolder: topLevelFolder
                                            }];
                                    }
                                });
                            });
                        }))];
                case 3:
                    endResults = _a.sent();
                    return [2 /*return*/, res.status(200).send(endResults)];
                case 4:
                    error_1 = _a.sent();
                    log.error('Error in /find_similar', error_1);
                    return [2 /*return*/, res.status(500).json({ error: 'Internal server error' })];
                case 5: return [2 /*return*/];
            }
        });
    });
}
export { findSimilar };
//# sourceMappingURL=find_similar.js.map