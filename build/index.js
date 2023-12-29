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
var __spreadArray =
    (this && this.__spreadArray) ||
    function (to, from, pack) {
        if (pack || arguments.length === 2)
            for (var i = 0, l = from.length, ar; i < l; i++) {
                if (ar || !(i in from)) {
                    if (!ar) ar = Array.prototype.slice.call(from, 0, i)
                    ar[i] = from[i]
                }
            }
        return to.concat(ar || Array.prototype.slice.call(from))
    }
//
import { indexDocument } from './indexing_pipeline/index.js'
import { findSimilar } from './search/find_similar.js'
import {
    addFeedSource,
    getAllRSSSources,
} from './indexing_pipeline/rssFeeds/index.js'
////////////////////////////////
/// GENERAL SETUP ///
////////////////////////////////
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { shell } from 'electron'
var __filename = fileURLToPath(import.meta.url)
var __dirname = dirname(__filename)
import express from 'express'
import electron, {
    app,
    BrowserWindow,
    Tray,
    Menu,
    nativeImage,
    dialog,
    Notification,
} from 'electron'
import url from 'url'
import xml2js from 'xml2js'
import pkg from 'electron-updater'
var autoUpdater = pkg.autoUpdater
import { AsyncDatabase } from 'promised-sqlite3'
import axios from 'axios'
import Store from 'electron-store'
import fs from 'fs'
import path from 'path'
import log from 'electron-log'
import * as lancedb from 'vectordb'
import dotEnv from 'dotenv'
import cors from 'cors'
import chokidar from 'chokidar'
dotEnv.config()
var isPackaged = app.isPackaged
var tray = null
var mainWindow
var downloadProgress = 0
var EXPRESS_PORT
if (isPackaged) {
    EXPRESS_PORT = 11922 // Different from common React port 3000 to avoid conflicts
} else {
    EXPRESS_PORT = 11923 // Different from common React port 3000 to avoid conflicts
}
var expressApp = express()
expressApp.use(cors({ origin: '*' }))
////////////////////////////////
/// DATATBASE SETUP STUFF ///
////////////////////////////////
import settings from 'electron-settings'
if (!isPackaged) {
    settings.configure({
        dir: path.join(electron.app.getAppPath(), '..', 'MemexDesktopData'),
    })
}
var store = isPackaged
    ? new Store()
    : new Store({
          cwd: path.join(electron.app.getAppPath(), '..', 'MemexDesktopData'),
      })
var sourcesDB = null
var vectorDBuri = app.isPackaged
    ? path.join(app.getPath('userData'), 'data/vectorDB')
    : path.join('../MemexDesktopData/vectorDB')
var vectorDocsTable = null
var vectorDocsTableName = 'vectordocstable'
var allTables = {
    sourcesDB: sourcesDB,
    vectorDocsTable: vectorDocsTable,
}
////////////////////////////////
/// FOLDERWATCHING SETUP///
////////////////////////////////
import { processPDF } from './indexing_pipeline/pdf_indexing.js'
import { processMarkdown } from './indexing_pipeline/markdown_indexing.js'
var pdfJS = null
var processingQueue = Promise.resolve()
var folderWatchers = {}
////////////////////////////////
/// TRANSFORMER JS STUFF ///
////////////////////////////////
// Setup
var modelPipeline
var modelEnvironment
// embedding functions
var embedTextFunction
var generateEmbeddings
var extractEntities
var entityExtractionFunction
////////////////////////////////
/// ELECTRON APP BASIC SETUP ///
////////////////////////////////
if (app.dock) {
    // Check if the dock API is available (macOS specific)
    app.dock.hide()
}
if (!settings.has('userPref.startOnStartup')) {
    settings.set('userPref.startOnStartup', true)
    app.setLoginItemSettings({
        openAtLogin: true,
    })
}
// if (require('electron-squirrel-startup')) {
//     app.quit()
// }
expressApp.use(express.json({ limit: '50mb' })) // adjust the limit as required
expressApp.use(express.urlencoded({ extended: true, limit: '50mb' })) // adjust the limit as required
process.on('uncaughtException', function (err) {
    log.error('There was an uncaught error', err)
})
process.on('unhandledRejection', function (reason, promise) {
    log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
// Example route 1: Simple Hello World
expressApp.get('/hello', function (req, res) {
    res.send("Hello World from Electron's Express server!")
})
// Example route 2: Send back query params
expressApp.get('/echo', function (req, res) {
    res.json(req.query)
})
// Example route 3other functionality you want to add
var server = null
function startExpress() {
    if (!server || !server.listening) {
        server = expressApp.listen(EXPRESS_PORT, function () {
            log.info(
                'Express server started on http://localhost:'.concat(
                    EXPRESS_PORT,
                ),
            )
            console.log(
                'Express server started on http://localhost:'.concat(
                    EXPRESS_PORT,
                ),
            )
        })
        server.keepAliveTimeout = 300000000000000000
        server.timeout = 0
        server.on('close', function () {
            console.log('Express server has shut down')
            log.info('Express server has shut down')
        })
    } else {
        console.log(
            'Express server is already running on http://localhost:'.concat(
                EXPRESS_PORT,
            ),
        )
    }
}
function checkSyncKey(inputKey) {
    var storedKey = store.get('syncKey')
    if (!storedKey) {
        store.set('syncKey', inputKey)
        return true
    } else if (storedKey === inputKey) {
        return true
    } else {
        return false
    }
}
function stopExpress() {
    return new Promise(function (resolve, reject) {
        if (server) {
            server.close(function (err) {
                if (err) {
                    log.error('Error stopping Express server:', err)
                    reject(err)
                } else {
                    console.log('Express server stopped.')
                    server = null // Nullify the server
                    resolve()
                }
                process.exit(0)
            })
        } else {
            resolve()
        }
    })
}
function pickDirectory(type) {
    console.log('pickDirectory', type)
    try {
        var directories = dialog.showOpenDialogSync({
            properties: ['openDirectory'],
        })
        if (directories && directories.length > 0) {
            var path = directories[0]
            store.set(type, path)
            return path // Return the first selected directory
        }
    } catch (error) {
        var err = error
        if (err.code === 'EACCES') {
            dialog.showErrorBox(
                'Permission Denied',
                'You do not have permission to access this directory. Please select a different directory or change your permission settings.',
            )
        } else {
            dialog.showErrorBox(
                'An error occurred',
                'An error occurred while selecting the directory. Please try again.',
            )
        }
        log.error(error)
    }
    return null
}
function createWindow() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [
                2 /*return*/,
                new Promise(function (resolve, reject) {
                    mainWindow = new BrowserWindow({
                        height: 600,
                        width: 800,
                        webPreferences: {
                            preload: path.join(__dirname, 'preload.js'),
                            nodeIntegration: true,
                        },
                    })
                    var indexPath
                    if (isPackaged) {
                        indexPath = path.join(
                            electron.app.getAppPath(),
                            'build',
                            'loading.html',
                        )
                    } else {
                        indexPath = path.join(
                            electron.app.getAppPath(),
                            'src',
                            'loading.html',
                        )
                    }
                    // mainWindow.webContents.openDevTools()
                    mainWindow.on('close', function (event) {
                        event.preventDefault()
                        mainWindow.hide()
                    })
                    mainWindow
                        .loadURL(
                            url.format({
                                pathname: indexPath,
                                protocol: 'file:',
                                slashes: true,
                            }),
                        )
                        .then(function () {
                            resolve() // Resolve the promise when the window is loaded
                        })
                        ['catch'](function (error) {
                            reject(error) // Reject the promise if there's an error
                        })
                }),
            ]
        })
    })
}
app.on('before-quit', function () {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tray === null || tray === void 0 ? void 0 : tray.destroy()
                    if (!server) return [3 /*break*/, 2]
                    log.info('Stopping Express server as parto of quit process')
                    return [4 /*yield*/, stopExpress()]
                case 1:
                    _a.sent()
                    _a.label = 2
                case 2:
                    log.info('before-quit')
                    return [2 /*return*/]
            }
        })
    })
})
app.on('ready', function () {
    return __awaiter(void 0, void 0, void 0, function () {
        var trayIconPath, trayIcon, updateMenuItem, contextMenu
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    return [4 /*yield*/, settings.get('hasOnboarded')]
                case 1:
                    if (!(_a.sent() === undefined)) return [3 /*break*/, 6]
                    return [4 /*yield*/, createWindow()]
                case 2:
                    _a.sent()
                    new Notification({
                        title: 'Memex Rabbit Hole Ready!',
                        body: 'Go back to the extension sidebar to continue',
                    }).show()
                    return [4 /*yield*/, initializeDatabase()]
                case 3:
                    _a.sent()
                    return [4 /*yield*/, initializeModels()]
                case 4:
                    embedTextFunction = _a.sent()
                    mainWindow.loadURL(
                        url.format({
                            pathname: isPackaged
                                ? path.join(
                                      electron.app.getAppPath(),
                                      'build',
                                      'index.html',
                                  )
                                : path.join(
                                      electron.app.getAppPath(),
                                      'src',
                                      'index.html',
                                  ),
                            protocol: 'file:',
                            slashes: true,
                        }),
                    )
                    if (!mainWindow || !mainWindow.isFocused()) {
                        new Notification({
                            title: 'Memex Rabbit Hole Ready!',
                            body: 'Go back to the extension sidebar to continue',
                        }).show()
                    }
                    return [4 /*yield*/, settings.set('hasOnboarded', true)]
                case 5:
                    _a.sent()
                    return [3 /*break*/, 9]
                case 6:
                    return [4 /*yield*/, initializeDatabase()]
                case 7:
                    _a.sent()
                    return [4 /*yield*/, initializeModels()]
                case 8:
                    embedTextFunction = _a.sent()
                    _a.label = 9
                case 9:
                    if (!allTables.sourcesDB || !allTables.vectorDocsTable) {
                        return [2 /*return*/]
                    }
                    // await initializeFileSystemWatchers()
                    try {
                        startExpress() // Start Express server first
                        log.catchErrors()
                        trayIconPath = null
                        if (isPackaged) {
                            trayIconPath = path.join(
                                process.resourcesPath,
                                'src/img/tray_icon.png',
                            )
                        } else {
                            trayIconPath = path.join(
                                electron.app.getAppPath(),
                                'src',
                                'img',
                                'tray_icon_dev.png',
                            )
                        }
                        trayIcon = nativeImage.createFromPath(trayIconPath)
                        if (!fs.existsSync(trayIconPath)) {
                            log.error('Tray icon not found:', trayIconPath)
                            return [2 /*return*/]
                        }
                        tray = new Tray(trayIcon)
                        tray.setImage(trayIcon)
                        updateMenuItem = {
                            label: 'Check for Updates',
                            click: function () {
                                autoUpdater.checkForUpdates()
                            },
                        }
                        contextMenu = Menu.buildFromTemplate([
                            {
                                label: 'Memex Local Sync - v'.concat(
                                    app.getVersion(),
                                ),
                                enabled: false,
                            },
                            {
                                label: 'Start on Startup',
                                type: 'checkbox',
                                checked: app.getLoginItemSettings().openAtLogin,
                                click: function (item) {
                                    var startOnStartup = item.checked
                                    app.setLoginItemSettings({
                                        openAtLogin: startOnStartup,
                                    })
                                },
                            },
                            {
                                label: 'Refresh Sync Key',
                                click: function () {
                                    store['delete']('syncKey')
                                },
                            },
                            {
                                label: 'Add Local folder',
                                click: function () {
                                    return __awaiter(
                                        this,
                                        void 0,
                                        void 0,
                                        function () {
                                            return __generator(
                                                this,
                                                function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            return [
                                                                4 /*yield*/,
                                                                watchNewFolder(),
                                                            ]
                                                        case 1:
                                                            _a.sent()
                                                            return [
                                                                2 /*return*/,
                                                            ]
                                                    }
                                                },
                                            )
                                        },
                                    )
                                },
                            },
                            updateMenuItem,
                            {
                                label: 'Exit',
                                click: function () {
                                    console.log('exit clicked before')
                                    app.quit()
                                    console.log('exit clicked')
                                },
                            },
                        ])
                        // Set the context menu to the Tray
                        tray.setContextMenu(contextMenu)
                        // Optional: Add a tooltip to the Tray
                        tray.setToolTip('Memex Local Sync Helper')
                        try {
                            autoUpdater
                                .checkForUpdates()
                                .then(function () {})
                                ['catch'](function (err) {
                                    log.error('err', err)
                                })
                            autoUpdater.on('update-available', function () {
                                return __awaiter(
                                    this,
                                    void 0,
                                    void 0,
                                    function () {
                                        return __generator(this, function (_a) {
                                            log.info('update available')
                                            log.info(
                                                autoUpdater.downloadUpdate(),
                                            )
                                            return [2 /*return*/]
                                        })
                                    },
                                )
                            })
                            autoUpdater.on('update-downloaded', function () {
                                log.info('update downloaded')
                                autoUpdater.quitAndInstall()
                            })
                        } catch (error) {
                            console.log('error', error)
                        }
                    } catch (error) {
                        log.error('error', error)
                        app.quit()
                    }
                    return [2 /*return*/]
            }
        })
    })
})
function generateEmbeddingFromText(text2embed) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    return [
                        4 /*yield*/,
                        generateEmbeddings(text2embed, {
                            pooling: 'mean',
                            normalize: true,
                        }),
                    ]
                case 1:
                    return [2 /*return*/, _a.sent()]
            }
        })
    })
}
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var dbPath,
            createRSSsourcesTable,
            createWebPagesTable,
            createAnnotationsTable,
            vectorDB,
            generateZeroVector,
            defaultVectorDocument,
            _a,
            error_1
        var _this = this
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    dbPath = null
                    if (isPackaged) {
                        if (
                            !fs.existsSync(
                                path.join(app.getPath('userData'), 'data'),
                            )
                        ) {
                            fs.mkdirSync(
                                path.join(app.getPath('userData'), 'data'),
                                {
                                    recursive: true,
                                },
                            )
                        }
                        dbPath = path.join(
                            app.getPath('userData'),
                            'data/sourcesDB.db',
                        )
                        log.log('dbPath', app.getPath('userData'))
                        fs.access(
                            app.getPath('userData'),
                            fs.constants.R_OK | fs.constants.W_OK,
                            function (err) {
                                return __awaiter(
                                    _this,
                                    void 0,
                                    void 0,
                                    function () {
                                        var dir
                                        return __generator(this, function (_a) {
                                            if (err) {
                                                log.error(
                                                    'No access to database file:',
                                                    err,
                                                )
                                            } else {
                                                log.log(
                                                    'Read/Write access is available for the database file',
                                                )
                                                dir = path.join(
                                                    app.getPath('userData'),
                                                    'data',
                                                )
                                                if (!fs.existsSync(dir)) {
                                                    fs.mkdirSync(dir, {
                                                        recursive: true,
                                                    })
                                                }
                                            }
                                            return [2 /*return*/]
                                        })
                                    },
                                )
                            },
                        )
                    } else {
                        if (
                            !fs.existsSync(
                                path.join(__dirname, '..', 'MemexDesktopData'),
                            )
                        ) {
                            fs.mkdirSync(
                                path.join(__dirname, '..', 'MemexDesktopData'),
                                {
                                    recursive: true,
                                },
                            )
                        }
                        dbPath = '../MemexDesktopData/sourcesDB.db'
                    }
                    return [
                        4 /*yield*/,
                        AsyncDatabase.open(dbPath),
                        // create Tables
                    ]
                case 1:
                    sourcesDB = _b.sent()
                    createRSSsourcesTable =
                        'CREATE TABLE IF NOT EXISTS rssSourcesTable(\n        feedUrl STRING PRIMARY KEY, \n        feedTitle STRING, \n        type STRING, \n        lastSynced INTEGER)\n        '
                    return [
                        4 /*yield*/,
                        sourcesDB.run(createRSSsourcesTable),
                        // create the websites table
                    ]
                case 2:
                    _b.sent()
                    createWebPagesTable =
                        'CREATE TABLE IF NOT EXISTS webPagesTable(\n        fullUrl STRING PRIMARY KEY, \n        pageTitle STRING, \n        fullHTML STRING, \n        contentType STRING, \n        createdWhen INTEGER, \n        sourceApplication STRING, \n        creatorId STRING, \n        metaDataJSON STRING)\n    '
                    return [
                        4 /*yield*/,
                        sourcesDB.run(createWebPagesTable),
                        // create the annotations table
                    ]
                case 3:
                    _b.sent()
                    createAnnotationsTable =
                        'CREATE TABLE IF NOT EXISTS annotationsTable(\n        fullUrl STRING PRIMARY KEY, \n        pageTitle STRING, \n        fullHTML STRING, \n        contentType STRING, \n        createdWhen INTEGER, \n        sourceApplication STRING, \n        creatorId STRING)\n        '
                    return [
                        4 /*yield*/,
                        sourcesDB.run(createAnnotationsTable),
                        // create the pdf document table
                        // let createPDFTable = `CREATE TABLE IF NOT EXISTS pdfTable(
                        //         id INTEGER PRIMARY KEY,
                        //         path STRING,
                        //         fingerPrint STRING,
                        //         pageTitle STRING,
                        //         extractedContent STRING,
                        //         createdWhen INTEGER,
                        //         sourceApplication STRING,
                        //         creatorId STRING,
                        //         metaDataJSON STRING
                        //         )
                        //         `
                        // await sourcesDB.run(createPDFTable)
                        // let createIndexQuery = `CREATE INDEX IF NOT EXISTS idx_pdfTable_fingerPrint ON pdfTable(fingerPrint)`
                        // await sourcesDB.run(createIndexQuery)
                        // let createIndexQueryForPath = `CREATE INDEX IF NOT EXISTS idx_pdfTable_path ON pdfTable(path)`
                        // await sourcesDB.run(createIndexQueryForPath)
                        // // Create the folders to watch table
                        // let createFoldersTable = `CREATE TABLE IF NOT EXISTS watchedFoldersTable(
                        //     id INTEGER PRIMARY KEY,
                        //     path STRING,
                        //     type STRING
                        //     metaDataJSON STRING
                        //     )
                        // `
                        // let createIndexQueryForType = `CREATE INDEX IF NOT EXISTS idx_watchedFoldersTable_type ON watchedFoldersTable(type)`
                        // await sourcesDB.run(createIndexQueryForType)
                        // await sourcesDB.run(createFoldersTable)
                        // // create the markdown table
                        // let createMarkdownTable = `CREATE TABLE IF NOT EXISTS markdownDocsTable(
                        //     id INTEGER PRIMARY KEY,
                        //     path STRING,
                        //     fingerPrint STRING,
                        //     pageTitle STRING,
                        //     content STRING,
                        //     sourceApplication STRING,
                        //     createdWhen INTEGER,
                        //     creatorId STRING,
                        //     metaDataJSON STRING
                        //     )
                        // `
                        // await sourcesDB.run(createMarkdownTable)
                        // let createIndexForMarkdownPath = `CREATE INDEX IF NOT EXISTS idx_markdownDocsTable_path ON markdownDocsTable(path)`
                        // await sourcesDB.run(createIndexForMarkdownPath)
                        // let createIndexForMarkdownFingerPrint = `CREATE INDEX IF NOT EXISTS idx_markdownDocsTable_fingerPrint ON markdownDocsTable(fingerPrint)`
                        // await sourcesDB.run(createIndexForMarkdownFingerPrint)
                    ]
                case 4:
                    _b.sent()
                    // create the pdf document table
                    // let createPDFTable = `CREATE TABLE IF NOT EXISTS pdfTable(
                    //         id INTEGER PRIMARY KEY,
                    //         path STRING,
                    //         fingerPrint STRING,
                    //         pageTitle STRING,
                    //         extractedContent STRING,
                    //         createdWhen INTEGER,
                    //         sourceApplication STRING,
                    //         creatorId STRING,
                    //         metaDataJSON STRING
                    //         )
                    //         `
                    // await sourcesDB.run(createPDFTable)
                    // let createIndexQuery = `CREATE INDEX IF NOT EXISTS idx_pdfTable_fingerPrint ON pdfTable(fingerPrint)`
                    // await sourcesDB.run(createIndexQuery)
                    // let createIndexQueryForPath = `CREATE INDEX IF NOT EXISTS idx_pdfTable_path ON pdfTable(path)`
                    // await sourcesDB.run(createIndexQueryForPath)
                    // // Create the folders to watch table
                    // let createFoldersTable = `CREATE TABLE IF NOT EXISTS watchedFoldersTable(
                    //     id INTEGER PRIMARY KEY,
                    //     path STRING,
                    //     type STRING
                    //     metaDataJSON STRING
                    //     )
                    // `
                    // let createIndexQueryForType = `CREATE INDEX IF NOT EXISTS idx_watchedFoldersTable_type ON watchedFoldersTable(type)`
                    // await sourcesDB.run(createIndexQueryForType)
                    // await sourcesDB.run(createFoldersTable)
                    // // create the markdown table
                    // let createMarkdownTable = `CREATE TABLE IF NOT EXISTS markdownDocsTable(
                    //     id INTEGER PRIMARY KEY,
                    //     path STRING,
                    //     fingerPrint STRING,
                    //     pageTitle STRING,
                    //     content STRING,
                    //     sourceApplication STRING,
                    //     createdWhen INTEGER,
                    //     creatorId STRING,
                    //     metaDataJSON STRING
                    //     )
                    // `
                    // await sourcesDB.run(createMarkdownTable)
                    // let createIndexForMarkdownPath = `CREATE INDEX IF NOT EXISTS idx_markdownDocsTable_path ON markdownDocsTable(path)`
                    // await sourcesDB.run(createIndexForMarkdownPath)
                    // let createIndexForMarkdownFingerPrint = `CREATE INDEX IF NOT EXISTS idx_markdownDocsTable_fingerPrint ON markdownDocsTable(fingerPrint)`
                    // await sourcesDB.run(createIndexForMarkdownFingerPrint)
                    console.log('SourcesDB initialized at: ', dbPath)
                    return [4 /*yield*/, lancedb.connect(vectorDBuri)]
                case 5:
                    vectorDB = _b.sent()
                    generateZeroVector = function (size) {
                        return new Array(size).fill(0)
                    }
                    defaultVectorDocument = {
                        fullurl: 'null',
                        pagetitle: 'null',
                        sourceapplication: 'null',
                        createdwhen: 0,
                        creatorid: 'null',
                        contenttype: 'null',
                        contenttext: 'null',
                        entities: 'null',
                        vector: generateZeroVector(768),
                    }
                    _b.label = 6
                case 6:
                    _b.trys.push([6, 14, , 15])
                    _b.label = 7
                case 7:
                    _b.trys.push([7, 9, , 12])
                    return [
                        4 /*yield*/,
                        vectorDB.openTable(vectorDocsTableName),
                    ]
                case 8:
                    vectorDocsTable = _b.sent()
                    return [3 /*break*/, 12]
                case 9:
                    _a = _b.sent()
                    if (!(vectorDocsTable == null)) return [3 /*break*/, 11]
                    return [
                        4 /*yield*/,
                        vectorDB.createTable(vectorDocsTableName, [
                            defaultVectorDocument,
                        ]),
                    ]
                case 10:
                    vectorDocsTable = _b.sent()
                    _b.label = 11
                case 11:
                    return [3 /*break*/, 12]
                case 12:
                    return [4 /*yield*/, vectorDocsTable.countRows()]
                case 13:
                    if (_b.sent() === 0) {
                        vectorDocsTable.add([defaultVectorDocument])
                    }
                    return [3 /*break*/, 15]
                case 14:
                    error_1 = _b.sent()
                    console.log('error', error_1)
                    return [3 /*break*/, 15]
                case 15:
                    allTables = {
                        sourcesDB: sourcesDB,
                        vectorDocsTable: vectorDocsTable,
                    }
                    console.log('VectorDB initialized at: ', vectorDBuri)
                    return [2 /*return*/]
            }
        })
    })
}
function initializeFileSystemWatchers() {
    return __awaiter(this, void 0, void 0, function () {
        var folderFetch, folders
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.all(
                                  'SELECT * FROM watchedFoldersTable',
                                  function (err, rows) {
                                      if (err) {
                                          return console.log(err.message)
                                      }
                                      // rows contains all entries in the table
                                      console.log(rows)
                                  },
                              ),
                    ]
                case 1:
                    folderFetch = _a.sent()
                    folders =
                        (folderFetch === null || folderFetch === void 0
                            ? void 0
                            : folderFetch.map(function (folder) {
                                  var obsidianFolder = path.join(
                                      folder.path,
                                      '.obsidian',
                                  )
                                  var logseqFolder = path.join(
                                      folder.path,
                                      'logseq',
                                  )
                                  if (fs.existsSync(obsidianFolder)) {
                                      folder.sourceApplication = 'obsidian'
                                  } else if (fs.existsSync(logseqFolder)) {
                                      folder.sourceApplication = 'logseq'
                                      folder.path = logseqFolder + '/pages'
                                  } else {
                                      folder.sourceApplication = 'local'
                                  }
                                  return folder
                              })) || []
                    if (folderFetch) {
                        startWatchers(folders, allTables)
                    }
                    return [2 /*return*/]
            }
        })
    })
}
function initializeModels() {
    return __awaiter(this, void 0, void 0, function () {
        var _a,
            pipeline,
            env,
            modelsDir,
            modelFilePath,
            modelUrl,
            writer_1,
            response_1,
            totalLength_1
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    return [4 /*yield*/, import('@xenova/transformers')]
                case 1:
                    ;(_a = _b.sent()), (pipeline = _a.pipeline), (env = _a.env)
                    modelPipeline = pipeline
                    modelEnvironment = env
                    modelEnvironment.allowLocalModels = true
                    if (isPackaged) {
                        modelsDir = path.join(app.getPath('userData'), 'models')
                    } else {
                        modelsDir = '../MemexDesktopData/models'
                    }
                    if (!fs.existsSync(modelsDir)) {
                        fs.mkdirSync(modelsDir, { recursive: true })
                    }
                    modelFilePath = path.join(
                        modelsDir,
                        'all-mpnet-base-v2_quantized.onnx',
                    )
                    if (!!fs.existsSync(modelFilePath)) return [3 /*break*/, 3]
                    modelUrl =
                        'https://huggingface.co/Xenova/all-mpnet-base-v2/resolve/main/onnx/model_quantized.onnx'
                    writer_1 = fs.createWriteStream(modelFilePath)
                    return [
                        4 /*yield*/,
                        axios({
                            url: modelUrl,
                            method: 'GET',
                            responseType: 'stream',
                        }),
                    ]
                case 2:
                    response_1 = _b.sent()
                    totalLength_1 = response_1.headers['content-length']
                    console.log('Starting download')
                    response_1.data.pipe(writer_1)
                    new Promise(function (resolve, reject) {
                        var bytesDownloaded = 0
                        response_1.data.on('data', function (chunk) {
                            bytesDownloaded += chunk.length
                            downloadProgress = Math.floor(
                                (bytesDownloaded / totalLength_1) * 100,
                            )
                            mainWindow.webContents.send(
                                'download-progress',
                                ''.concat(downloadProgress, '%'),
                            )
                        })
                        response_1.data.on('end', function () {
                            console.log('Download complete')
                            resolve()
                        })
                        writer_1.on('error', reject)
                    })
                    _b.label = 3
                case 3:
                    modelEnvironment.localModelPath = modelFilePath
                    console.log('Model file path1: '.concat(modelFilePath))
                    return [
                        4 /*yield*/,
                        modelPipeline(
                            'feature-extraction',
                            'Xenova/all-mpnet-base-v2',
                        ),
                    ]
                case 4:
                    generateEmbeddings = _b.sent()
                    embedTextFunction = generateEmbeddingFromText
                    //general setup of model pipeline needs to be on highest level to be consistent in chunking size for vectors
                    ///
                    // // prepare NER extraction model, needs to be on highest level to be consistent in chunking size for vectors
                    // // modelEnvironment.allowRemoteModels = false;
                    // modelEnvironment.localModelPath =
                    //   "./models/bert-base-multilingual-cased-ner-hrl_quantized.onnx";
                    // extractEntities = await modelPipeline(
                    //   "token-classification",
                    //   "Xenova/bert-base-multilingual-cased-ner-hrl"
                    // );
                    // entityExtractionFunction = await extractEntitiesFromText;
                    // console.log(
                    //   await entityExtractionFunction(
                    //     "To wean their country off imported oil and gas, and in the hope of retiring dirty coal-fired power stations, China’s leaders have poured money into wind and solar energy. But they are also turning to one of the most sustainable forms of non-renewable power. Over the past decade China has added 37 nuclear reactors, for a total of 55, according to the International Atomic Energy Agency, a UN body. During that same period America, which leads the world with 93 reactors, added two."
                    //   )
                    // );
                    // entityExtractionFunction(
                    //   "In 1945, to wean their country off imported oil and gas, and in the hope of retiring dirty coal-fired power stations, China’s leaders and in particular Xi Xinping and John malcovich have poured money into wind and solar energy and using chemical substances like H20 and co2. But they are also turning to one of the most sustainable forms of non-renewable power. Over the past decade China has added 37 nuclear reactors, for a total of 55, according to the International Atomic Energy Agency, a UN body. During that same period America, which leads the world with 93 reactors, added two."
                    // );
                    // setting up all databases and tables
                    return [2 /*return*/, embedTextFunction]
            }
        })
    })
}
// async function extractEntitiesFromText(text2analzye) {
//     return await extractEntities(text2analzye)
// }
function isPathComponentValid(component) {
    if (
        typeof component !== 'string' ||
        !component.match(/^[a-z0-9\-]{2,20}$/)
    ) {
        return false
    } else {
        return true
    }
}
///////////////////////////
/// RABBIT HOLE ENDPOINTS ///
/////////////////////////
expressApp.put('/add_page', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var fullUrl,
            pageTitle,
            fullHTML,
            createdWhen,
            contentType,
            creatorId,
            sourceApplication,
            metadataJSON,
            error_2
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    fullUrl = req.body.fullUrl
                    pageTitle = req.body.pageTitle
                    fullHTML = req.body.fullHTML
                    createdWhen = req.body.createdWhen
                    contentType = req.body.contentType
                    creatorId = req.body.creatorId
                    sourceApplication = req.body.sourceApplication
                    metadataJSON = ''
                    _a.label = 1
                case 1:
                    _a.trys.push([1, 4, , 5])
                    return [
                        4 /*yield*/,
                        allTables.sourcesDB.run(
                            'INSERT INTO webPagesTable VALUES(?, ?, ?, ?, ?, ?, ?, ? )',
                            [
                                fullUrl,
                                pageTitle,
                                fullHTML,
                                contentType,
                                createdWhen,
                                sourceApplication,
                                creatorId,
                                metadataJSON,
                            ],
                        ),
                    ]
                case 2:
                    _a.sent()
                    return [
                        4 /*yield*/,
                        indexDocument({
                            fullUrl: fullUrl,
                            pageTitle: pageTitle,
                            fullHTML: fullHTML,
                            createdWhen: createdWhen,
                            contentType: contentType,
                            sourceApplication: sourceApplication,
                            creatorId: creatorId,
                            embedTextFunction: embedTextFunction,
                            allTables: allTables,
                            entityExtractionFunction: entityExtractionFunction,
                        }),
                    ]
                case 3:
                    _a.sent()
                    return [2 /*return*/, res.status(200).send(true)]
                case 4:
                    error_2 = _a.sent()
                    log.error('Error in /index_document', error_2)
                    return [
                        2 /*return*/,
                        res
                            .status(500)
                            .json({ error: 'Internal server error' }),
                    ]
                case 5:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.put('/add_annotation', function (req, res) {
    var _a, _b, _c, _d, _e, _f, _g
    return __awaiter(this, void 0, void 0, function () {
        var fullUrl,
            pageTitle,
            fullHTML,
            createdWhen,
            contentType,
            creatorId,
            sourceApplication,
            error_3
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    fullUrl =
                        ((_a = req.body) === null || _a === void 0
                            ? void 0
                            : _a.fullUrl) || ''
                    pageTitle =
                        ((_b = req.body) === null || _b === void 0
                            ? void 0
                            : _b.pageTitle) || ''
                    fullHTML =
                        ((_c = req.body) === null || _c === void 0
                            ? void 0
                            : _c.fullHTML) || ''
                    createdWhen =
                        ((_d = req.body) === null || _d === void 0
                            ? void 0
                            : _d.createdWhen) || ''
                    contentType =
                        ((_e = req.body) === null || _e === void 0
                            ? void 0
                            : _e.contentType) || ''
                    creatorId =
                        ((_f = req.body) === null || _f === void 0
                            ? void 0
                            : _f.creatorId) || ''
                    sourceApplication =
                        ((_g = req.body) === null || _g === void 0
                            ? void 0
                            : _g.sourceApplication) || ''
                    _h.label = 1
                case 1:
                    _h.trys.push([1, 4, , 5])
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.run(
                                  'INSERT INTO annotationsTable VALUES(?, ?, ?, ?, ?, ?, ?)',
                                  [
                                      fullUrl,
                                      pageTitle,
                                      fullHTML,
                                      contentType,
                                      createdWhen,
                                      sourceApplication,
                                      creatorId,
                                  ],
                              ),
                    ]
                case 2:
                    _h.sent()
                    return [
                        4 /*yield*/,
                        indexDocument({
                            fullUrl: fullUrl,
                            pageTitle: pageTitle,
                            fullHTML: fullHTML,
                            createdWhen: createdWhen,
                            contentType: contentType,
                            sourceApplication: sourceApplication,
                            creatorId: creatorId,
                            embedTextFunction: embedTextFunction,
                            allTables: allTables,
                            entityExtractionFunction: entityExtractionFunction,
                        }),
                    ]
                case 3:
                    _h.sent()
                    return [2 /*return*/, res.status(200).send(true)]
                case 4:
                    error_3 = _h.sent()
                    log.error('Error in /index_annotation', error_3)
                    return [
                        2 /*return*/,
                        res
                            .status(500)
                            .json({ error: 'Internal server error' }),
                    ]
                case 5:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.post('/get_similar', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    console.log('find_similar', embedTextFunction)
                    return [
                        4 /*yield*/,
                        findSimilar(
                            req,
                            res,
                            embedTextFunction,
                            allTables,
                            entityExtractionFunction,
                        ),
                    ]
                case 1:
                    return [2 /*return*/, _a.sent()]
            }
        })
    })
})
expressApp.post('/load_feed_sources', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var sourcesList, feedSourcesOutput, error_4
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    _a.label = 1
                case 1:
                    _a.trys.push([1, 3, , 4])
                    return [
                        4 /*yield*/,
                        allTables.sourcesDB.all(
                            'SELECT * FROM rssSourcesTable',
                        ),
                        //  , function(err, rows) {
                        //   if (err) {
                        //     console.error(err);
                        //     rturn;
                        //   }
                        //   console.log("rows", rows);
                    ]
                case 2:
                    sourcesList = _a.sent()
                    feedSourcesOutput = sourcesList.map(function (source) {
                        return {
                            feedUrl: source.feedUrl,
                            feedTitle: source.feedTitle,
                            feedFavIcon: source.feedFavIcon,
                            type: source.type,
                        }
                    })
                    console.log('feedSources', feedSourcesOutput)
                    return [
                        2 /*return*/,
                        res.status(200).send(feedSourcesOutput),
                    ]
                case 3:
                    error_4 = _a.sent()
                    console.log(
                        'Error loading feed sources in /load_feed_sources',
                        error_4,
                    )
                    return [
                        2 /*return*/,
                        res.status(500).json({ error: error_4 }),
                    ]
                case 4:
                    return [2 /*return*/]
            }
        })
    })
})
var feedSourceQueue = []
expressApp.post('/add_feed_source', function (req, res) {
    var _a, _b, _c, _d
    return __awaiter(this, void 0, void 0, function () {
        var feedSources,
            _loop_1,
            i,
            state_1,
            _i,
            feedSourceQueue_1,
            feedSource,
            feedUrl,
            feedTitle,
            type,
            error_5
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    log.log('called add_feed_source')
                    if (!checkSyncKey(req.body.syncKey)) {
                        console.log('sync key not valid')
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    feedSources = req.body.feedSources
                    console.log('feedSources', req.body)
                    feedSourceQueue = __spreadArray(
                        __spreadArray([], feedSourceQueue, true),
                        feedSources,
                        true,
                    )
                    console.log('feedSourceQueue', feedSourceQueue)
                    _e.label = 1
                case 1:
                    _e.trys.push([1, 10, , 11])
                    _loop_1 = function (i) {
                        var feedUrl,
                            feedTitle,
                            type,
                            response,
                            data,
                            parser,
                            parsedData_1,
                            sql
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    feedUrl =
                                        (_a = feedSources[i]) === null ||
                                        _a === void 0
                                            ? void 0
                                            : _a.feedUrl
                                    feedTitle =
                                        (_b = feedSources[i]) === null ||
                                        _b === void 0
                                            ? void 0
                                            : _b.feedTitle
                                    type =
                                        (_c = feedSources[i]) === null ||
                                        _c === void 0
                                            ? void 0
                                            : _c.type
                                    if (!!feedTitle) return [3 /*break*/, 3]
                                    return [4 /*yield*/, fetch(feedUrl)]
                                case 1:
                                    response = _f.sent()
                                    return [4 /*yield*/, response.text()]
                                case 2:
                                    data = _f.sent()
                                    parser = new xml2js.Parser()
                                    parsedData_1 = null
                                    parser.parseString(
                                        data,
                                        function (err, result) {
                                            if (err) {
                                                console.error(
                                                    'Failed to parse RSS feed: ',
                                                    err,
                                                )
                                            } else {
                                                parsedData_1 =
                                                    result.rss.channel[0]
                                            }
                                        },
                                    )
                                    if (parsedData_1) {
                                        feedTitle =
                                            (_d =
                                                parsedData_1 === null ||
                                                parsedData_1 === void 0
                                                    ? void 0
                                                    : parsedData_1.title[0]) !==
                                                null && _d !== void 0
                                                ? _d
                                                : ''
                                    }
                                    _f.label = 3
                                case 3:
                                    if (feedUrl && feedTitle) {
                                        try {
                                            sql =
                                                'INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)'
                                            sourcesDB === null ||
                                            sourcesDB === void 0
                                                ? void 0
                                                : sourcesDB.run(sql, [
                                                      feedUrl,
                                                      feedTitle,
                                                      type || null,
                                                      null,
                                                  ])
                                            log.log(
                                                'Added feed '.concat(feedUrl),
                                            )
                                        } catch (error) {
                                            log.error('Error saving feed')
                                            return [
                                                2 /*return*/,
                                                { value: void 0 },
                                            ]
                                        }
                                    }
                                    return [2 /*return*/]
                            }
                        })
                    }
                    i = 0
                    _e.label = 2
                case 2:
                    if (!(i < feedSources.length)) return [3 /*break*/, 5]
                    return [5 /*yield**/, _loop_1(i)]
                case 3:
                    state_1 = _e.sent()
                    if (typeof state_1 === 'object')
                        return [2 /*return*/, state_1.value]
                    _e.label = 4
                case 4:
                    i++
                    return [3 /*break*/, 2]
                case 5:
                    ;(_i = 0), (feedSourceQueue_1 = feedSourceQueue)
                    _e.label = 6
                case 6:
                    if (!(_i < feedSourceQueue_1.length))
                        return [3 /*break*/, 9]
                    feedSource = feedSourceQueue_1[_i]
                    ;(feedUrl = feedSource.feedUrl),
                        (feedTitle = feedSource.feedTitle),
                        (type = feedSource.type)
                    console.log('Start indexing', feedUrl)
                    return [
                        4 /*yield*/,
                        addFeedSource(
                            feedUrl,
                            feedTitle,
                            embedTextFunction,
                            allTables,
                            type,
                            entityExtractionFunction,
                        ),
                        // if (success) {
                        //   // TODO: Handle different outcomes
                        // }
                    ]
                case 7:
                    _e.sent()
                    _e.label = 8
                case 8:
                    _i++
                    return [3 /*break*/, 6]
                case 9:
                    return [2 /*return*/, res.status(200).send(true)]
                case 10:
                    error_5 = _e.sent()
                    log.error(
                        'Error adding feed sources in /add_rss_feed',
                        error_5,
                    )
                    return [
                        2 /*return*/,
                        res.status(500).json({ error: error_5 }),
                    ]
                case 11:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.get('/get_all_rss_sources', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var rssSources, error_6
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    _a.label = 1
                case 1:
                    _a.trys.push([1, 3, , 4])
                    return [4 /*yield*/, getAllRSSSources(allTables)]
                case 2:
                    rssSources = _a.sent()
                    return [2 /*return*/, res.status(200).send(rssSources)]
                case 3:
                    error_6 = _a.sent()
                    log.error(
                        'Error adding '.concat(
                            req.body.feedUrl,
                            ' in /add_rss_feed',
                        ),
                        error_6,
                    )
                    return [
                        2 /*return*/,
                        res.status(500).json({ error: error_6 }),
                    ]
                case 4:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.post('/remove_feed_source', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var feedUrl, error_7
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    _a.label = 1
                case 1:
                    _a.trys.push([1, 3, , 4])
                    feedUrl = req.body.feedUrl
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.run(
                                  'DELETE FROM rssSourcesTable WHERE feedUrl = ?',
                                  [feedUrl],
                              ),
                    ]
                case 2:
                    _a.sent()
                    return [
                        2 /*return*/,
                        res
                            .status(200)
                            .send('Feed source removed successfully'),
                    ]
                case 3:
                    error_7 = _a.sent()
                    log.error(
                        'Error removing '.concat(
                            req.body.feedUrl,
                            ' in /remove_feed_source',
                        ),
                        error_7,
                    )
                    return [
                        2 /*return*/,
                        res.status(500).json({ error: error_7 }),
                    ]
                case 4:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.post('/open_file', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var path, error_8
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res.status(403).send('No access to open file'),
                        ]
                    }
                    path = req.body.path
                    if (!fs.existsSync(path)) {
                        return [
                            2 /*return*/,
                            res.status(404).send('File not found'),
                        ]
                    }
                    _a.label = 1
                case 1:
                    _a.trys.push([1, 3, , 4])
                    return [4 /*yield*/, shell.openExternal(path)]
                case 2:
                    _a.sent()
                    return [
                        2 /*return*/,
                        res.status(200).send('File opened successfully'),
                    ]
                case 3:
                    error_8 = _a.sent()
                    return [
                        2 /*return*/,
                        res.status(500).send('Error opening file'),
                    ]
                case 4:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.post('/fetch_all_folders', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var folders
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res.status(403).send('No access to open file'),
                        ]
                    }
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.all(
                                  'SELECT * FROM watchedFoldersTable',
                                  function (err, rows) {
                                      if (err) {
                                          return console.log(err.message)
                                      }
                                      // rows contains all entries in the table
                                      console.log(rows)
                                  },
                              ),
                    ]
                case 1:
                    folders = _a.sent()
                    console.log('folders', folders)
                    return [2 /*return*/, res.status(200).json(folders)]
            }
        })
    })
})
expressApp.post('/watch_new_folder', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var folder
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res.status(403).send('No access to open file'),
                        ]
                    }
                    return [4 /*yield*/, watchNewFolder()]
                case 1:
                    folder = _a.sent()
                    return [2 /*return*/, res.status(200).json(folder)]
            }
        })
    })
})
// this is added as a global object so we can store all the watcher processes to cancel again later if needed
expressApp.post('/remove_folder_to_watch', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var body, id, originalDocument, watcherToKill
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res.status(403).send('No access to open file'),
                        ]
                    }
                    body = req.body
                    id = body.id
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.get(
                                  'SELECT path FROM watchedFoldersTable WHERE id = ?',
                                  [id],
                              ),
                    ]
                case 1:
                    originalDocument = _a.sent() || { path: '' }
                    watcherToKill =
                        folderWatchers[
                            originalDocument === null ||
                            originalDocument === void 0
                                ? void 0
                                : originalDocument.path
                        ]
                    watcherToKill.close()
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.run(
                                  'DELETE FROM watchedFoldersTable WHERE id = ?',
                                  [id],
                              ),
                    ]
                case 2:
                    _a.sent()
                    delete folderWatchers[originalDocument.path]
                    return [
                        2 /*return*/,
                        res.status(200).json({ success: true }),
                    ]
            }
        })
    })
})
function watchNewFolder() {
    return __awaiter(this, void 0, void 0, function () {
        var newWindow,
            newFolderData,
            newFolder,
            sourceApplication,
            obsidianFolder,
            logseqFolder,
            topLevelFolder,
            folders,
            folderPaths,
            result,
            id,
            folder,
            newFolderObject
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    newWindow = new BrowserWindow({
                        height: 10,
                        width: 10,
                        transparent: true,
                        frame: false,
                    })
                    newWindow.focus()
                    newWindow.on('close', function (event) {
                        event.preventDefault()
                        newWindow.hide()
                    })
                    return [
                        4 /*yield*/,
                        dialog.showOpenDialog(newWindow, {
                            properties: ['openDirectory'],
                        }),
                    ]
                case 1:
                    newFolderData = _a.sent()
                    newFolder = newFolderData.filePaths[0]
                    newWindow.close()
                    if (!newFolder) {
                        return [2 /*return*/, false]
                    }
                    sourceApplication = 'local'
                    obsidianFolder = path.join(newFolder, '.obsidian')
                    logseqFolder = path.join(newFolder, 'logseq')
                    topLevelFolder = newFolder.split('/').pop()
                    if (fs.existsSync(obsidianFolder)) {
                        sourceApplication = 'obsidian'
                    } else if (fs.existsSync(logseqFolder)) {
                        sourceApplication = 'logseq'
                        newFolder = logseqFolder + '/pages'
                    }
                    folders = []
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.all(
                                  'SELECT * FROM watchedFoldersTable',
                                  function (err, rows) {
                                      if (err) {
                                          return console.log(err.message)
                                      }
                                      // rows contains all entries in the table
                                      console.log(rows)
                                  },
                              ),
                    ]
                case 2:
                    folders = _a.sent()
                    folderPaths = folders
                        ? folders.map(function (folder) {
                              return folder.path
                          })
                        : []
                    if (folderPaths.includes(newFolder)) {
                        return [2 /*return*/]
                    }
                    return [
                        4 /*yield*/,
                        sourcesDB === null || sourcesDB === void 0
                            ? void 0
                            : sourcesDB.run(
                                  'INSERT INTO watchedFoldersTable(path, type) VALUES(?, ?, ?)',
                                  [newFolder, sourceApplication, ''],
                              ),
                    ]
                case 3:
                    result = _a.sent()
                    id =
                        result === null || result === void 0
                            ? void 0
                            : result.lastID
                    try {
                        folder = {
                            path: newFolder,
                            sourceApplication: sourceApplication,
                            id: id,
                        }
                        startWatchers([folder], allTables)
                    } catch (error) {
                        log.error('Error in /watch_new_folder:', error)
                    }
                    newFolderObject = {
                        path: newFolder,
                        sourceApplication: sourceApplication,
                        id: id,
                    }
                    return [2 /*return*/, newFolderObject]
            }
        })
    })
}
function startWatchers(folders, allTables) {
    return __awaiter(this, void 0, void 0, function () {
        var ignoredPathObsidian, ignoredPathLogseq, deletionInProgress
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!pdfJS) return [3 /*break*/, 2]
                    return [4 /*yield*/, import('pdfjs-dist')]
                case 1:
                    pdfJS = _a.sent()
                    _a.label = 2
                case 2:
                    ignoredPathObsidian = store.get('obsidian') || null
                    ignoredPathLogseq = store.get('logseq') || null
                    console.log('ignoredPathObsidian', ignoredPathObsidian)
                    deletionInProgress = false
                    // take the given folderPath array and start watchers on each folder
                    ;(folders === null || folders === void 0
                        ? void 0
                        : folders.length) > 0 &&
                        (folders === null || folders === void 0
                            ? void 0
                            : folders.forEach(function (folder) {
                                  var watcher = chokidar.watch(folder.path, {
                                      ignored: [
                                          /(^|[\/\\])\../,
                                          ignoredPathObsidian,
                                          ignoredPathLogseq,
                                      ],
                                      persistent: true,
                                  })
                                  folderWatchers[folder.path] = watcher
                                  watcher.on('add', function (path, stats) {
                                      return __awaiter(
                                          this,
                                          void 0,
                                          void 0,
                                          function () {
                                              var retryCount,
                                                  maxRetries,
                                                  waitForDeletion,
                                                  error_9
                                              var _this = this
                                              return __generator(
                                                  this,
                                                  function (_a) {
                                                      switch (_a.label) {
                                                          case 0:
                                                              retryCount = 0
                                                              maxRetries = 20
                                                              waitForDeletion =
                                                                  function () {
                                                                      return new Promise(
                                                                          function (
                                                                              resolve,
                                                                              reject,
                                                                          ) {
                                                                              if (
                                                                                  !deletionInProgress
                                                                              ) {
                                                                                  resolve()
                                                                              } else if (
                                                                                  retryCount >=
                                                                                  maxRetries
                                                                              ) {
                                                                                  reject(
                                                                                      new Error(
                                                                                          'Max retries reached',
                                                                                      ),
                                                                                  )
                                                                              } else {
                                                                                  setTimeout(
                                                                                      function () {
                                                                                          retryCount++
                                                                                          waitForDeletion()
                                                                                              .then(
                                                                                                  resolve,
                                                                                              )
                                                                                              [
                                                                                                  'catch'
                                                                                              ](
                                                                                                  reject,
                                                                                              )
                                                                                      },
                                                                                      500,
                                                                                  )
                                                                              }
                                                                          },
                                                                      )
                                                                  }
                                                              _a.label = 1
                                                          case 1:
                                                              _a.trys.push([
                                                                  1,
                                                                  3,
                                                                  ,
                                                                  4,
                                                              ])
                                                              return [
                                                                  4 /*yield*/,
                                                                  waitForDeletion(),
                                                                  // Continue processing after deletion is complete
                                                              ]
                                                          case 2:
                                                              _a.sent()
                                                              return [
                                                                  3 /*break*/,
                                                                  4,
                                                              ]
                                                          case 3:
                                                              error_9 =
                                                                  _a.sent()
                                                              // Handle error if max retries reached
                                                              console.error(
                                                                  error_9,
                                                              )
                                                              return [
                                                                  3 /*break*/,
                                                                  4,
                                                              ]
                                                          case 4:
                                                              processingQueue =
                                                                  processingQueue.then(
                                                                      function () {
                                                                          return __awaiter(
                                                                              _this,
                                                                              void 0,
                                                                              void 0,
                                                                              function () {
                                                                                  return __generator(
                                                                                      this,
                                                                                      function (
                                                                                          _a,
                                                                                      ) {
                                                                                          switch (
                                                                                              _a.label
                                                                                          ) {
                                                                                              case 0:
                                                                                                  // rename is a deletion and re-addition in the events, no rename unfortunately
                                                                                                  return [
                                                                                                      4 /*yield*/,
                                                                                                      processFiles(
                                                                                                          path,
                                                                                                          folder.sourceApplication,
                                                                                                          'addOrRename',
                                                                                                          pdfJS,
                                                                                                      ),
                                                                                                  ]
                                                                                              case 1:
                                                                                                  // rename is a deletion and re-addition in the events, no rename unfortunately
                                                                                                  return [
                                                                                                      2 /*return*/,
                                                                                                      _a.sent(),
                                                                                                  ]
                                                                                          }
                                                                                      },
                                                                                  )
                                                                              },
                                                                          )
                                                                      },
                                                                  )
                                                              return [
                                                                  2 /*return*/,
                                                              ]
                                                      }
                                                  },
                                              )
                                          },
                                      )
                                  })
                                  watcher.on('unlink', function (path, stats) {
                                      return __awaiter(
                                          this,
                                          void 0,
                                          void 0,
                                          function () {
                                              var fingerPrint
                                              return __generator(
                                                  this,
                                                  function (_a) {
                                                      switch (_a.label) {
                                                          case 0:
                                                              console.log(
                                                                  'Deletion of file started: ',
                                                                  path,
                                                              )
                                                              deletionInProgress = true
                                                              if (
                                                                  !path.endsWith(
                                                                      '.pdf',
                                                                  )
                                                              )
                                                                  return [
                                                                      3 /*break*/,
                                                                      4,
                                                                  ]
                                                              return [
                                                                  4 /*yield*/,
                                                                  sourcesDB ===
                                                                      null ||
                                                                  sourcesDB ===
                                                                      void 0
                                                                      ? void 0
                                                                      : sourcesDB.get(
                                                                            'SELECT fingerPrint FROM pdfTable WHERE path = ?',
                                                                            [
                                                                                path,
                                                                            ],
                                                                        ),
                                                              ]
                                                          case 1:
                                                              fingerPrint =
                                                                  _a.sent() || {
                                                                      fingerPrint:
                                                                          '',
                                                                  }
                                                              return [
                                                                  4 /*yield*/,
                                                                  allTables.vectorDocsTable[
                                                                      'delete'
                                                                  ](
                                                                      "fullurl = '".concat(
                                                                          fingerPrint ===
                                                                              null ||
                                                                              fingerPrint ===
                                                                                  void 0
                                                                              ? void 0
                                                                              : fingerPrint.fingerPrint.toString(),
                                                                          "'",
                                                                      ),
                                                                  ),
                                                              ]
                                                          case 2:
                                                              _a.sent()
                                                              return [
                                                                  4 /*yield*/,
                                                                  allTables.sourcesDB.run(
                                                                      'DELETE FROM pdfTable WHERE path = ?',
                                                                      [path],
                                                                  ),
                                                              ]
                                                          case 3:
                                                              _a.sent()
                                                              deletionInProgress = false
                                                              console.log(
                                                                  'deletion done: ',
                                                                  path,
                                                              )
                                                              _a.label = 4
                                                          case 4:
                                                              if (
                                                                  !path.endsWith(
                                                                      '.md',
                                                                  )
                                                              )
                                                                  return [
                                                                      3 /*break*/,
                                                                      6,
                                                                  ]
                                                              return [
                                                                  4 /*yield*/,
                                                                  allTables.sourcesDB.run(
                                                                      'DELETE FROM markdownDocsTable WHERE path = ?',
                                                                      [path],
                                                                  ),
                                                              ]
                                                          case 5:
                                                              _a.sent()
                                                              deletionInProgress = false
                                                              _a.label = 6
                                                          case 6:
                                                              return [
                                                                  2 /*return*/,
                                                              ]
                                                      }
                                                  },
                                              )
                                          },
                                      )
                                  })
                                  var debounceTimers = {}
                                  watcher.on('change', function (path, stats) {
                                      return __awaiter(
                                          this,
                                          void 0,
                                          void 0,
                                          function () {
                                              var _this = this
                                              return __generator(
                                                  this,
                                                  function (_a) {
                                                      // Clear the previous timer if it exists
                                                      if (
                                                          debounceTimers[path]
                                                      ) {
                                                          clearTimeout(
                                                              debounceTimers[
                                                                  path
                                                              ],
                                                          )
                                                      }
                                                      // Set a new timer
                                                      debounceTimers[path] =
                                                          setTimeout(
                                                              function () {
                                                                  processingQueue =
                                                                      processingQueue.then(
                                                                          function () {
                                                                              return __awaiter(
                                                                                  _this,
                                                                                  void 0,
                                                                                  void 0,
                                                                                  function () {
                                                                                      return __generator(
                                                                                          this,
                                                                                          function (
                                                                                              _a,
                                                                                          ) {
                                                                                              switch (
                                                                                                  _a.label
                                                                                              ) {
                                                                                                  case 0:
                                                                                                      return [
                                                                                                          4 /*yield*/,
                                                                                                          processFiles(
                                                                                                              path,
                                                                                                              folder.sourceApplication,
                                                                                                              'contentChange',
                                                                                                              pdfJS,
                                                                                                          ),
                                                                                                          // Once the processing is done, remove the timer from the map
                                                                                                      ]
                                                                                                  case 1:
                                                                                                      _a.sent()
                                                                                                      // Once the processing is done, remove the timer from the map
                                                                                                      delete debounceTimers[
                                                                                                          path
                                                                                                      ]
                                                                                                      return [
                                                                                                          2 /*return*/,
                                                                                                      ]
                                                                                              }
                                                                                          },
                                                                                      )
                                                                                  },
                                                                              )
                                                                          },
                                                                      )
                                                              },
                                                              300,
                                                          ) // 30 seconds
                                                      return [2 /*return*/]
                                                  },
                                              )
                                          },
                                      )
                                  })
                              }))
                    console.log(
                        'watchers setup: ',
                        Object.keys(folderWatchers).length,
                    )
                    return [2 /*return*/]
            }
        })
    })
}
function processFiles(file, sourceApplication, changeType, pdfJS) {
    return __awaiter(this, void 0, void 0, function () {
        var extension
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    extension = file.split('.').pop()
                    if (!(extension === 'pdf')) return [3 /*break*/, 2]
                    return [
                        4 /*yield*/,
                        processPDF(file, allTables, pdfJS, embedTextFunction),
                    ]
                case 1:
                    _a.sent()
                    return [2 /*return*/]
                case 2:
                    if (!(extension === 'md')) return [3 /*break*/, 4]
                    return [
                        4 /*yield*/,
                        processMarkdown(
                            file,
                            allTables,
                            embedTextFunction,
                            sourceApplication,
                            changeType,
                        ),
                    ]
                case 3:
                    _a.sent()
                    return [2 /*return*/]
                case 4:
                    if (extension === 'epub') {
                    } else if (extension === 'mobi') {
                    }
                    _a.label = 5
                case 5:
                    return [2 /*return*/]
            }
        })
    })
}
///////////////////////////
/// PKM SYNC ENDPOINTS ///
/////////////////////////
expressApp.post('/set-directory', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var directoryPath, pkmSyncType
        return __generator(this, function (_a) {
            if (!checkSyncKey(req.body.syncKey)) {
                return [
                    2 /*return*/,
                    res.status(403).send('Only one app instance allowed'),
                ]
            }
            try {
                pkmSyncType = req.body.pkmSyncType
                if (typeof pkmSyncType !== 'string') {
                    res.status(400).json({ error: 'Invalid pkmSyncType' })
                    return [2 /*return*/]
                }
                directoryPath = pickDirectory(pkmSyncType)
                if (directoryPath) {
                    store.set(pkmSyncType, directoryPath)
                    res.status(200).send(directoryPath)
                    return [2 /*return*/, path]
                } else {
                    res.status(400).json({ error: 'No directory selected' })
                    return [2 /*return*/, null]
                }
            } catch (error) {
                log.error('Error in /set-directory:', error)
                res.status(500).json({
                    error: 'Internal server error',
                })
                return [2 /*return*/, null]
            }
            return [2 /*return*/]
        })
    })
})
expressApp.put('/update-file', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var body, pkmSyncType, pageTitle, fileContent, directoryPath, filePath
        return __generator(this, function (_a) {
            if (!checkSyncKey(req.body.syncKey)) {
                return [
                    2 /*return*/,
                    res.status(403).send('Only one app instance allowed'),
                ]
            }
            try {
                body = req.body
                pkmSyncType = body.pkmSyncType
                pageTitle = body.pageTitle
                fileContent = body.fileContent
                if (
                    typeof pkmSyncType !== 'string' ||
                    typeof pageTitle !== 'string' ||
                    typeof fileContent !== 'string'
                ) {
                    res.status(400).json({ error: 'Invalid input' })
                    return [2 /*return*/]
                }
                directoryPath = store.get(pkmSyncType)
                if (!directoryPath) {
                    res.status(400).json({
                        error: 'No directory found for given pkmSyncType',
                    })
                    return [2 /*return*/]
                }
                filePath = ''
                    .concat(directoryPath, '/')
                    .concat(pageTitle, '.md')
                fs.writeFileSync(filePath, fileContent)
                res.status(200).send(filePath)
            } catch (error) {
                log.error('Error in /update-file:', error)
                res.status(500).json({ error: 'Internal server error' })
            }
            return [2 /*return*/]
        })
    })
})
expressApp.post('/get-file-content', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var pkmSyncType, pageTitle, directoryPath, filePath, fileContent
        return __generator(this, function (_a) {
            if (!checkSyncKey(req.body.syncKey)) {
                return [
                    2 /*return*/,
                    res.status(403).send('Only one app instance allowed'),
                ]
            }
            try {
                pkmSyncType = req.body.pkmSyncType
                pageTitle = req.body.pageTitle
                if (
                    typeof pkmSyncType !== 'string' ||
                    typeof pageTitle !== 'string'
                ) {
                    res.status(400).json({ error: 'Invalid input' })
                    return [2 /*return*/]
                }
                directoryPath = store.get(pkmSyncType)
                if (!directoryPath) {
                    res.status(400).json({
                        error: 'No directory found for given pkmSyncType',
                    })
                    return [2 /*return*/]
                }
                filePath = directoryPath + '/' + pageTitle + '.md'
                if (!fs.existsSync(filePath)) {
                    res.status(400).json({ error: 'File not found' })
                    return [2 /*return*/]
                }
                fileContent = fs.readFileSync(filePath, 'utf-8')
                res.status(200).send(fileContent)
            } catch (error) {
                log.error('Error in /get-file-content:', error)
                res.status(500).json({ error: 'Internal server error' })
            }
            return [2 /*return*/]
        })
    })
})
///////////////////////////
/// BACKUP ENDPOINTS ///
/////////////////////////
// Exposing Server Endpoints for BACKUPS
var backupPath = ''
expressApp.post('/status', function (req, res) {
    console.log(' /status called')
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    res.status(200).send('running')
})
expressApp.get('/status', function (req, res) {
    console.log(' /status called')
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    res.status(200).send('running')
})
expressApp.post('/pick-directory', function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    try {
        var directoryPath = pickDirectory('backup')
        if (directoryPath) {
            res.json({ path: directoryPath })
            res.status(200).send(directoryPath)
        } else {
            res.status(400).json({ error: 'No directory selected' })
        }
    } catch (error) {
        log.error('Error in /pick-directory:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})
// get the backup folder location
expressApp.get('/backup/location', function (req, res) {
    return __awaiter(void 0, void 0, void 0, function () {
        var backupPath_1
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!checkSyncKey(req.body.syncKey))
                        return [3 /*break*/, 1]
                    res.status(403)
                    return [3 /*break*/, 4]
                case 1:
                    backupPath_1 = store.get('backupPath')
                    if (!!backupPath_1) return [3 /*break*/, 3]
                    return [4 /*yield*/, pickDirectory('backup')]
                case 2:
                    backupPath_1 = _a.sent()
                    _a.label = 3
                case 3:
                    store.set('backup', backupPath_1)
                    res.status(200).send(backupPath_1)
                    _a.label = 4
                case 4:
                    return [2 /*return*/]
            }
        })
    })
})
expressApp.get('/backup/start-change-location', function (req, res) {
    return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!checkSyncKey(req.body.syncKey)) {
                        return [
                            2 /*return*/,
                            res
                                .status(403)
                                .send('Only one app instance allowed'),
                        ]
                    }
                    _b = (_a = res.status(200)).send
                    return [4 /*yield*/, pickDirectory('backup')]
                case 1:
                    _b.apply(_a, [_c.sent()])
                    return [2 /*return*/]
            }
        })
    })
})
// listing files
expressApp.get('/backup/:collection', function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    var collection = req.params.collection
    if (!isPathComponentValid(collection)) {
        return res.status(400).send('Malformed collection parameter')
    }
    var dirpath = backupPath + '/backup/'.concat(collection)
    try {
        var filelist = fs.readdirSync(dirpath, 'utf-8')
        filelist = filelist.filter(function (filename) {
            // check if filename contains digits only to ignore system files like .DS_STORE
            return /^\d+$/.test(filename)
        })
        res.status(200).send(filelist.toString())
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404)
            res.status(404).json({ error: 'Collection not found.' })
        } else throw err
    }
})
// getting files
expressApp.get('/backup/:collection/:timestamp', function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    var filename = req.params.timestamp
    if (!isPathComponentValid(filename)) {
        return res.status(400).send('Malformed timestamp parameter')
    }
    var collection = req.params.collection
    if (!isPathComponentValid(collection)) {
        return res.status(400).send('Malformed collection parameter')
    }
    var filepath =
        backupPath + '/backup/'.concat(collection, '/') + filename + '.json'
    try {
        res.status(200).send(fs.readFileSync(filepath, 'utf-8'))
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404)
            req.body = 'File not found.'
        } else throw err
    }
})
expressApp.put('/backup/:collection/:timestamp', function (req, res) {
    return __awaiter(void 0, void 0, void 0, function () {
        var filename, collection, dirpath, filepath
        return __generator(this, function (_a) {
            if (!checkSyncKey(req.body.syncKey)) {
                return [
                    2 /*return*/,
                    res.status(403).send('Only one app instance allowed'),
                ]
            }
            filename = req.params.timestamp
            if (!isPathComponentValid(filename)) {
                return [
                    2 /*return*/,
                    res.status(400).send('Malformed timestamp parameter'),
                ]
            }
            collection = req.params.collection
            if (!isPathComponentValid(collection)) {
                return [
                    2 /*return*/,
                    res.status(400).send('Malformed collection parameter'),
                ]
            }
            console.log('req.body', req.body, collection)
            dirpath = req.body.backupPath + '/backup/'.concat(collection)
            try {
                fs.mkdirSync(dirpath, { recursive: true })
            } catch (err) {
                log.error(err)
                return [
                    2 /*return*/,
                    res.status(500).send('Failed to create directory.'),
                ]
            }
            filepath = dirpath + '/'.concat(filename)
            fs.writeFile(filepath, JSON.stringify(req.body), function (err) {
                if (err) {
                    log.error(err)
                    return res.status(500).send('Failed to write to file.')
                }
                res.status(200).send('Data saved successfully.')
            })
            return [2 /*return*/]
        })
    })
})
//# sourceMappingURL=index.js.map
