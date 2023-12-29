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
import { indexDocument } from '../index.js';
import { cleanFullHTML } from '../utils.js';
import * as xml2js from 'xml2js';
import * as cheerio from 'cheerio';
import { extract as extractFeed } from '@extractus/feed-extractor';
import * as log from 'electron-log';
function getAllRSSSources(allTables) {
    return __awaiter(this, void 0, void 0, function () {
        var rssSourcesTable, allRSSSources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rssSourcesTable = allTables.rssSourcesTable;
                    return [4 /*yield*/, rssSourcesTable.getAll()];
                case 1:
                    allRSSSources = _a.sent();
                    return [2 /*return*/, allRSSSources];
            }
        });
    });
}
function addFeedSource(feedUrl, feedTitle, embedTextFunction, allTables, type, entityExtractionFunction) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var sourcesDB, existingEndpoint, error_1, feedDataToSave, isSubstack_1, url, feedURLsubstack, parser, htmlContent, response, error_2, parsedData_1, links_2, url, feedUrlSubstack, allSiteMapPages_2, response, text, $_1, anchors, _loop_1, _i, allSiteMapPages_1, page, _loop_2, _b, links_1, link, feedResult, error_3, _loop_3, _c, _d, entry, state_1, sql, error_4, error_5;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 33, , 34]);
                    sourcesDB = allTables.sourcesDB;
                    existingEndpoint = void 0;
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, sourcesDB.get("SELECT * FROM rssSourcesTable WHERE feedUrl = ? AND lastSynced IS NOT NULL", [feedUrl])];
                case 2:
                    existingEndpoint = _e.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _e.sent();
                    log.error('Error checking existing endpoint');
                    return [2 /*return*/, false];
                case 4:
                    if (existingEndpoint) {
                        console.log('Feed Already Saved: ', feedUrl);
                        return [2 /*return*/, true];
                    }
                    feedDataToSave = {
                        feedUrl: feedUrl,
                        feedTitle: feedTitle,
                        lastSynced: null
                    };
                    isSubstack_1 = feedUrl.includes('.substack.com/') || type === 'substack';
                    if (!!isSubstack_1) return [3 /*break*/, 10];
                    url = new URL(feedUrl);
                    feedURLsubstack = "".concat(url.protocol, "//").concat(url.host, "/feed");
                    parser = void 0;
                    htmlContent = void 0;
                    _e.label = 5;
                case 5:
                    _e.trys.push([5, 8, , 9]);
                    return [4 /*yield*/, fetch(feedURLsubstack)];
                case 6:
                    response = _e.sent();
                    return [4 /*yield*/, response.text()];
                case 7:
                    htmlContent = _e.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_2 = _e.sent();
                    console.log('error fetching feed', error_2);
                    throw new Error('error fetching feed:' + error_2.message);
                case 9:
                    try {
                        parser = new xml2js.Parser();
                        parser.parseString(htmlContent, function (err, result) {
                            var _a, _b;
                            if (err) {
                                console.log('Failed to parse HTML content: ', err);
                            }
                            else {
                                parsedData_1 = (_a = result === null || result === void 0 ? void 0 : result.rss) === null || _a === void 0 ? void 0 : _a.channel[0];
                                var imageUrl = (_b = parsedData_1 === null || parsedData_1 === void 0 ? void 0 : parsedData_1.image[0]) === null || _b === void 0 ? void 0 : _b.url[0];
                                if (imageUrl &&
                                    imageUrl.startsWith('https://substackcdn.com')) {
                                    isSubstack_1 = true;
                                }
                            }
                        });
                    }
                    catch (error) {
                        console.log('Failed to parse out xml content: ', error);
                        log.log('Failed to parse out xml content: ', error);
                    }
                    _e.label = 10;
                case 10:
                    if (!isSubstack_1) return [3 /*break*/, 21];
                    links_2 = [];
                    url = new URL(feedUrl);
                    feedUrlSubstack = "".concat(url.protocol, "//").concat(url.host, "/sitemap");
                    allSiteMapPages_2 = [];
                    return [4 /*yield*/, fetch(feedUrlSubstack)];
                case 11:
                    response = _e.sent();
                    return [4 /*yield*/, response.text()];
                case 12:
                    text = _e.sent();
                    $_1 = cheerio.load(text);
                    anchors = $_1('a');
                    anchors.each(function (i, anchor) {
                        var href = $_1(anchor).attr('href');
                        if (href === null || href === void 0 ? void 0 : href.startsWith('/sitemap')) {
                            allSiteMapPages_2.push(href);
                        }
                    });
                    _loop_1 = function (page) {
                        var siteMapPageUrl, pageResponse, pageText, $page, pageAnchors;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    siteMapPageUrl = "".concat(url.protocol, "//").concat(url.host).concat(page);
                                    return [4 /*yield*/, fetch(siteMapPageUrl)];
                                case 1:
                                    pageResponse = _f.sent();
                                    return [4 /*yield*/, pageResponse.text()];
                                case 2:
                                    pageText = _f.sent();
                                    $page = cheerio.load(pageText);
                                    pageAnchors = $page('a');
                                    pageAnchors.each(function (i, anchor) {
                                        var href = $page(anchor).attr('href');
                                        if (href === null || href === void 0 ? void 0 : href.startsWith("".concat(feedUrl.replace('/feed', ''), "/p/"))) {
                                            links_2.push(href);
                                        }
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, allSiteMapPages_1 = allSiteMapPages_2;
                    _e.label = 13;
                case 13:
                    if (!(_i < allSiteMapPages_1.length)) return [3 /*break*/, 16];
                    page = allSiteMapPages_1[_i];
                    return [5 /*yield**/, _loop_1(page)];
                case 14:
                    _e.sent();
                    _e.label = 15;
                case 15:
                    _i++;
                    return [3 /*break*/, 13];
                case 16:
                    if (links_2 && links_2.length === 0) {
                        return [2 /*return*/, false];
                    }
                    _loop_2 = function (link) {
                        var response_1, fullHTML, cleanHTML, $_2, metaDataTags, scripts, jsonScript, scriptHtml, datePublishedUnix, title, pageDataToSave;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                                case 1:
                                    _g.sent();
                                    return [4 /*yield*/, fetch(link, {
                                            headers: {
                                                Accept: 'text/html'
                                            }
                                        })];
                                case 2:
                                    response_1 = _g.sent();
                                    return [4 /*yield*/, response_1.text()];
                                case 3:
                                    fullHTML = _g.sent();
                                    return [4 /*yield*/, cleanFullHTML(fullHTML)];
                                case 4:
                                    cleanHTML = _g.sent();
                                    $_2 = cheerio.load(fullHTML);
                                    metaDataTags = void 0;
                                    // get the page metadata containing lots of useful information about the post we can use later
                                    try {
                                        scripts = $_2('script');
                                        jsonScript = scripts
                                            .filter(function (i, script) {
                                            return $_2(script).attr('type') ===
                                                'application/ld+json';
                                        })
                                            .first();
                                        scriptHtml = jsonScript.html();
                                        if (scriptHtml) {
                                            metaDataTags = JSON.parse(scriptHtml);
                                        }
                                    }
                                    catch (error) { }
                                    datePublishedUnix = (metaDataTags === null || metaDataTags === void 0 ? void 0 : metaDataTags.datePublished)
                                        ? ((_a = new Date(metaDataTags === null || metaDataTags === void 0 ? void 0 : metaDataTags.datePublished)) === null || _a === void 0 ? void 0 : _a.getTime()) / 1000
                                        : 0;
                                    title = $_2('title').text() || metaDataTags.headline;
                                    pageDataToSave = {
                                        fullUrl: link,
                                        pageTitle: title,
                                        cleanHTML: cleanHTML,
                                        fullHTML: fullHTML,
                                        contentType: 'rss-feed-item',
                                        createdWhen: datePublishedUnix,
                                        sourceApplication: 'RSS',
                                        creatorId: '',
                                        metaDataJSON: JSON.stringify(metaDataTags) || ''
                                    };
                                    return [4 /*yield*/, saveAndIndexFeedPages(sourcesDB, pageDataToSave, embedTextFunction, allTables, entityExtractionFunction)];
                                case 5:
                                    _g.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, links_1 = links_2;
                    _e.label = 17;
                case 17:
                    if (!(_b < links_1.length)) return [3 /*break*/, 20];
                    link = links_1[_b];
                    return [5 /*yield**/, _loop_2(link)];
                case 18:
                    _e.sent();
                    _e.label = 19;
                case 19:
                    _b++;
                    return [3 /*break*/, 17];
                case 20: return [3 /*break*/, 29];
                case 21:
                    feedResult = void 0;
                    _e.label = 22;
                case 22:
                    _e.trys.push([22, 24, , 25]);
                    return [4 /*yield*/, extractFeed(feedUrl)];
                case 23:
                    feedResult = _e.sent();
                    return [3 /*break*/, 25];
                case 24:
                    error_3 = _e.sent();
                    log.log('error extracting feed:', error_3, feedUrl);
                    throw new Error('error extracting feed:' + error_3.message);
                case 25:
                    if (!(feedResult && feedResult.entries)) return [3 /*break*/, 29];
                    _loop_3 = function (entry) {
                        var response, fullHTML, cleanHTML, $, metaDataTags, scripts, jsonScript, scriptHtml, datePublishedUnix, pageDataToSave;
                        return __generator(this, function (_h) {
                            switch (_h.label) {
                                case 0:
                                    if (!(entry === null || entry === void 0 ? void 0 : entry.link)) {
                                        return [2 /*return*/, { value: false }];
                                    }
                                    return [4 /*yield*/, fetch(entry === null || entry === void 0 ? void 0 : entry.link, {
                                            headers: {
                                                Accept: 'text/html'
                                            }
                                        })];
                                case 1:
                                    response = _h.sent();
                                    return [4 /*yield*/, response.text()];
                                case 2:
                                    fullHTML = _h.sent();
                                    return [4 /*yield*/, cleanFullHTML(fullHTML)];
                                case 3:
                                    cleanHTML = _h.sent();
                                    $ = cheerio.load(fullHTML);
                                    metaDataTags = void 0;
                                    try {
                                        scripts = $('script');
                                        jsonScript = scripts
                                            .filter(function (i, script) {
                                            return $(script).attr('type') ===
                                                'application/ld+json';
                                        })
                                            .first();
                                        scriptHtml = jsonScript.html();
                                        if (scriptHtml) {
                                            metaDataTags = JSON.parse(scriptHtml);
                                        }
                                    }
                                    catch (error) {
                                        log.warn('Could not parse JSON metadata :', entry.link);
                                    }
                                    datePublishedUnix = entry.published
                                        ? new Date(entry.published).getTime() / 1000
                                        : 0;
                                    pageDataToSave = {
                                        fullHTML: fullHTML,
                                        cleanHTML: cleanHTML,
                                        fullUrl: entry.link,
                                        pageTitle: entry.title,
                                        contentType: 'rss-feed-item',
                                        createdWhen: datePublishedUnix,
                                        sourceApplication: 'RSS',
                                        creatorId: '',
                                        metaDataJSON: JSON.stringify(metaDataTags) || ''
                                    };
                                    return [4 /*yield*/, saveAndIndexFeedPages(sourcesDB, pageDataToSave, embedTextFunction, allTables, entityExtractionFunction)];
                                case 4:
                                    _h.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _c = 0, _d = feedResult.entries;
                    _e.label = 26;
                case 26:
                    if (!(_c < _d.length)) return [3 /*break*/, 29];
                    entry = _d[_c];
                    return [5 /*yield**/, _loop_3(entry)];
                case 27:
                    state_1 = _e.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _e.label = 28;
                case 28:
                    _c++;
                    return [3 /*break*/, 26];
                case 29:
                    _e.trys.push([29, 31, , 32]);
                    console.log('update rssSourcesTable', feedUrl, feedDataToSave);
                    sql = "INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)";
                    return [4 /*yield*/, sourcesDB.run(sql, [
                            feedDataToSave.feedUrl,
                            feedDataToSave.feedTitle,
                            isSubstack_1 ? 'substack' : type,
                            Date.now(),
                        ])];
                case 30:
                    _e.sent();
                    return [2 /*return*/, true];
                case 31:
                    error_4 = _e.sent();
                    console.log('Error saving feed to database: ', feedUrl, error_4);
                    return [3 /*break*/, 32];
                case 32: return [3 /*break*/, 34];
                case 33:
                    error_5 = _e.sent();
                    console.log('error indexing rss feed', error_5);
                    return [2 /*return*/, false];
                case 34: return [2 /*return*/, true];
            }
        });
    });
}
// TODOS
// add the RSS feed source to the cron job
// index the RSS feed source and set the last indexed date to now
function saveAndIndexFeedPages(sourcesDB, pageDataToSave, embedTextFunction, allTables, entityExtractionFunction) {
    return __awaiter(this, void 0, void 0, function () {
        var error_6, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, sourcesDB.run("INSERT INTO webPagesTable VALUES(?, ?, ?, ?, ?, ?, ?, ? )", [
                            pageDataToSave.fullUrl,
                            pageDataToSave.pageTitle,
                            pageDataToSave.cleanHTML,
                            pageDataToSave.contentType,
                            pageDataToSave.createdWhen,
                            pageDataToSave.sourceApplication,
                            pageDataToSave.creatorId,
                            pageDataToSave.metaDataJSON,
                        ])];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _a.sent();
                    console.log('Page Already Saved: ', error_6);
                    return [2 /*return*/];
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, indexDocument({
                            fullUrl: pageDataToSave.fullUrl,
                            pageTitle: pageDataToSave.pageTitle,
                            fullHTML: pageDataToSave.cleanHTML,
                            contentType: 'rss-feed-item',
                            sourceApplication: 'RSS',
                            embedTextFunction: embedTextFunction,
                            allTables: allTables,
                            entityExtractionFunction: entityExtractionFunction
                        })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_7 = _a.sent();
                    console.log('Error indexing:', error_7);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
export { addFeedSource, getAllRSSSources };
//# sourceMappingURL=index.js.map