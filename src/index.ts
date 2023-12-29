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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
const { autoUpdater } = pkg

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
import { Server } from 'http'
dotEnv.config()

const isPackaged = app.isPackaged
let tray: Tray | null = null
let mainWindow: BrowserWindow
let downloadProgress: number = 0

let EXPRESS_PORT: number
if (isPackaged) {
    EXPRESS_PORT = 11922 // Different from common React port 3000 to avoid conflicts
} else {
    EXPRESS_PORT = 11923 // Different from common React port 3000 to avoid conflicts
}
let expressApp: express.Express = express()
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
const store = isPackaged
    ? new Store()
    : new Store({
          cwd: path.join(electron.app.getAppPath(), '..', 'MemexDesktopData'),
      })
let sourcesDB: AsyncDatabase | null = null
let vectorDBuri: string = app.isPackaged
    ? path.join(app.getPath('userData'), 'data/vectorDB')
    : path.join('../MemexDesktopData/vectorDB')

let vectorDocsTable: any = null
let vectorDocsTableName: string = 'vectordocstable'
let allTables: any = {
    sourcesDB: sourcesDB,
    vectorDocsTable: vectorDocsTable,
}

////////////////////////////////
/// FOLDERWATCHING SETUP///
////////////////////////////////

import { processPDF } from './indexing_pipeline/pdf_indexing.js'
import { processMarkdown } from './indexing_pipeline/markdown_indexing.js'
let pdfJS: any = null
let processingQueue: Promise<any> = Promise.resolve()
let folderWatchers: any = {}

interface FolderPath {
    path: string
    type: 'obsidian' | 'local' | 'logseq'
}

interface Source {
    feedUrl: string
    feedTitle: string
    feedFavIcon: string
    type: string
    // add other properties as needed
}

interface Folder {
    path: string
    sourceApplication: 'obsidian' | 'local' | 'logseq'
}

////////////////////////////////
/// TRANSFORMER JS STUFF ///
////////////////////////////////

// Setup
let modelPipeline: any
let modelEnvironment: any

// embedding functions
let embedTextFunction: any
let generateEmbeddings: any
let extractEntities: any
let entityExtractionFunction: any

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

process.on('uncaughtException', (err) => {
    log.error('There was an uncaught error', err)
})

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Example route 1: Simple Hello World
expressApp.get('/hello', (req, res) => {
    res.send("Hello World from Electron's Express server!")
})

// Example route 2: Send back query params
expressApp.get('/echo', (req, res) => {
    res.json(req.query)
})

// Example route 3other functionality you want to add
let server: Server | null = null

function startExpress() {
    if (!server || !server.listening) {
        server = expressApp.listen(EXPRESS_PORT, () => {
            log.info(
                `Express server started on http://localhost:${EXPRESS_PORT}`,
            )
            console.log(
                `Express server started on http://localhost:${EXPRESS_PORT}`,
            )
        })
        server.keepAliveTimeout = 300000000000000000
        server.timeout = 0

        server.on('close', () => {
            console.log('Express server has shut down')
            log.info('Express server has shut down')
        })
    } else {
        console.log(
            `Express server is already running on http://localhost:${EXPRESS_PORT}`,
        )
    }
}

function checkSyncKey(inputKey: string) {
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
    return new Promise<void>((resolve, reject) => {
        if (server) {
            server.close((err) => {
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

interface CustomError extends Error {
    code?: string
}

function pickDirectory(type: string) {
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
        const err = error as CustomError
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

async function createWindow() {
    return new Promise<void>((resolve, reject) => {
        mainWindow = new BrowserWindow({
            height: 600,
            width: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: true,
            },
        })

        let indexPath
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
        mainWindow.on('close', (event) => {
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
            .then(() => {
                resolve() // Resolve the promise when the window is loaded
            })
            .catch((error) => {
                reject(error) // Reject the promise if there's an error
            })
    })
}

app.on('before-quit', async function () {
    tray?.destroy()
    if (server) {
        log.info('Stopping Express server as parto of quit process')
        await stopExpress()
    }
    log.info('before-quit')
})

app.on('ready', async () => {
    if ((await settings.get('hasOnboarded')) === undefined) {
        await createWindow()
        new Notification({
            title: 'Memex Rabbit Hole Ready!',
            body: 'Go back to the extension sidebar to continue',
        }).show()
        await initializeDatabase()
        embedTextFunction = await initializeModels()
        mainWindow.loadURL(
            url.format({
                pathname: isPackaged
                    ? path.join(
                          electron.app.getAppPath(),
                          'build',
                          'index.html',
                      )
                    : path.join(electron.app.getAppPath(), 'src', 'index.html'),
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
        await settings.set('hasOnboarded', true)
    } else {
        await initializeDatabase()
        embedTextFunction = await initializeModels()
    }
    if (!allTables.sourcesDB || !allTables.vectorDocsTable) {
        return
    }
    await initializeFileSystemWatchers()
    try {
        startExpress() // Start Express server first

        log.catchErrors()
        let trayIconPath = null
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
        var trayIcon = nativeImage.createFromPath(trayIconPath)

        if (!fs.existsSync(trayIconPath)) {
            log.error('Tray icon not found:', trayIconPath)
            return
        }

        tray = new Tray(trayIcon)
        tray.setImage(trayIcon)

        var updateMenuItem = {
            label: 'Check for Updates',
            click: function () {
                autoUpdater.checkForUpdates()
            },
        }

        var contextMenu = Menu.buildFromTemplate([
            {
                label: `Memex Local Sync - v${app.getVersion()}`,
                enabled: false, // This makes the menu item non-clickable
            },
            {
                label: 'Start on Startup',
                type: 'checkbox',
                checked: app.getLoginItemSettings().openAtLogin, // Check if the app is set to start on login
                click: function (item) {
                    var startOnStartup = item.checked
                    app.setLoginItemSettings({ openAtLogin: startOnStartup })
                },
            },
            {
                label: 'Refresh Sync Key',
                click: function () {
                    store.delete('syncKey')
                },
            },
            {
                label: 'Add Local folder',
                click: async function () {
                    await watchNewFolder()
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
                .catch(function (err) {
                    log.error('err', err)
                })
            autoUpdater.on('update-available', async function () {
                log.info('update available')
                log.info(autoUpdater.downloadUpdate())
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
})

async function generateEmbeddingFromText(text2embed: string) {
    return await generateEmbeddings(text2embed, {
        pooling: 'mean',
        normalize: true,
    })
}

async function initializeDatabase() {
    let dbPath = null

    if (isPackaged) {
        if (!fs.existsSync(path.join(app.getPath('userData'), 'data'))) {
            fs.mkdirSync(path.join(app.getPath('userData'), 'data'), {
                recursive: true,
            })
        }
        dbPath = path.join(app.getPath('userData'), 'data/sourcesDB.db')
        log.log('dbPath', app.getPath('userData'))
        fs.access(
            app.getPath('userData'),
            fs.constants.R_OK | fs.constants.W_OK,
            async (err) => {
                if (err) {
                    log.error('No access to database file:', err)
                } else {
                    log.log(
                        'Read/Write access is available for the database file',
                    )
                    const dir = path.join(app.getPath('userData'), 'data')
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true })
                    }
                }
            },
        )
    } else {
        if (!fs.existsSync(path.join(__dirname, '..', 'MemexDesktopData'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'MemexDesktopData'), {
                recursive: true,
            })
        }
        dbPath = '../MemexDesktopData/sourcesDB.db'
    }
    sourcesDB = await AsyncDatabase.open(dbPath)

    // create Tables
    let createRSSsourcesTable = `CREATE TABLE IF NOT EXISTS rssSourcesTable(
        feedUrl STRING PRIMARY KEY, 
        feedTitle STRING, 
        type STRING, 
        lastSynced INTEGER)
        `
    await sourcesDB.run(createRSSsourcesTable)

    // create the websites table

    let createWebPagesTable = `CREATE TABLE IF NOT EXISTS webPagesTable(
        fullUrl STRING PRIMARY KEY, 
        pageTitle STRING, 
        fullHTML STRING, 
        contentType STRING, 
        createdWhen INTEGER, 
        sourceApplication STRING, 
        creatorId STRING, 
        metaDataJSON STRING)
    `
    await sourcesDB.run(createWebPagesTable)

    // create the annotations table

    let createAnnotationsTable = `CREATE TABLE IF NOT EXISTS annotationsTable(
        fullUrl STRING PRIMARY KEY, 
        pageTitle STRING, 
        fullHTML STRING, 
        contentType STRING, 
        createdWhen INTEGER, 
        sourceApplication STRING, 
        creatorId STRING)
        `
    await sourcesDB.run(createAnnotationsTable)

    // create the pdf document table

    let createPDFTable = `CREATE TABLE IF NOT EXISTS pdfTable(
            id INTEGER PRIMARY KEY,
            path STRING,
            fingerPrint STRING,
            pageTitle STRING,
            extractedContent STRING,
            createdWhen INTEGER,
            sourceApplication STRING,
            creatorId STRING,
            metaDataJSON STRING
            )
            `
    await sourcesDB.run(createPDFTable)
    let createIndexQuery = `CREATE INDEX IF NOT EXISTS idx_pdfTable_fingerPrint ON pdfTable(fingerPrint)`
    await sourcesDB.run(createIndexQuery)

    let createIndexQueryForPath = `CREATE INDEX IF NOT EXISTS idx_pdfTable_path ON pdfTable(path)`
    await sourcesDB.run(createIndexQueryForPath)

    // Create the folders to watch table

    let createFoldersTable = `CREATE TABLE IF NOT EXISTS watchedFoldersTable(
        id INTEGER PRIMARY KEY,
        path STRING,
        type STRING
        metaDataJSON STRING
        )
    `
    let createIndexQueryForType = `CREATE INDEX IF NOT EXISTS idx_watchedFoldersTable_type ON watchedFoldersTable(type)`
    await sourcesDB.run(createIndexQueryForType)

    await sourcesDB.run(createFoldersTable)

    // create the markdown table
    let createMarkdownTable = `CREATE TABLE IF NOT EXISTS markdownDocsTable(
        id INTEGER PRIMARY KEY,
        path STRING,
        fingerPrint STRING,
        pageTitle STRING,
        content STRING,
        sourceApplication STRING,
        createdWhen INTEGER,
        creatorId STRING,
        metaDataJSON STRING
        )
    `

    await sourcesDB.run(createMarkdownTable)
    let createIndexForMarkdownPath = `CREATE INDEX IF NOT EXISTS idx_markdownDocsTable_path ON markdownDocsTable(path)`
    await sourcesDB.run(createIndexForMarkdownPath)

    let createIndexForMarkdownFingerPrint = `CREATE INDEX IF NOT EXISTS idx_markdownDocsTable_fingerPrint ON markdownDocsTable(fingerPrint)`
    await sourcesDB.run(createIndexForMarkdownFingerPrint)

    console.log('SourcesDB initialized at: ', dbPath)
    let vectorDB = await lancedb.connect(vectorDBuri)

    const generateZeroVector = (size: number) => {
        return new Array(size).fill(0)
    }
    let defaultVectorDocument = {
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

    try {
        try {
            vectorDocsTable = await vectorDB.openTable(vectorDocsTableName)
        } catch {
            if (vectorDocsTable == null) {
                vectorDocsTable = await vectorDB.createTable(
                    vectorDocsTableName,
                    [defaultVectorDocument],
                )
            }
        }

        if ((await vectorDocsTable.countRows()) === 0) {
            vectorDocsTable.add([defaultVectorDocument])
        }
    } catch (error) {
        console.log('error', error)
    }

    allTables = {
        sourcesDB: sourcesDB,
        vectorDocsTable: vectorDocsTable,
    }
    console.log('VectorDB initialized at: ', vectorDBuri)
    return
}

async function initializeFileSystemWatchers() {
    // starting folder watchers:
    let folderFetch: Folder[] | undefined = await sourcesDB?.all(
        `SELECT * FROM watchedFoldersTable`,
        function (err: any, rows: number) {
            if (err) {
                return console.log(err.message)
            }
            // rows contains all entries in the table
            console.log(rows)
        },
    )

    let folders: Folder[] =
        folderFetch?.map((folder: Folder) => {
            const obsidianFolder = path.join(folder.path, '.obsidian')
            const logseqFolder = path.join(folder.path, 'logseq')
            if (fs.existsSync(obsidianFolder)) {
                folder.sourceApplication = 'obsidian'
            } else if (fs.existsSync(logseqFolder)) {
                folder.sourceApplication = 'logseq'
                folder.path = logseqFolder + '/pages'
            } else {
                folder.sourceApplication = 'local'
            }
            return folder
        }) || []
    if (folderFetch) {
        startWatchers(folders, allTables)
    }
}

async function initializeModels() {
    let { pipeline, env } = await import('@xenova/transformers')
    modelPipeline = pipeline
    modelEnvironment = env
    modelEnvironment.allowLocalModels = true

    let modelsDir

    if (isPackaged) {
        modelsDir = path.join(app.getPath('userData'), 'models')
    } else {
        modelsDir = '../MemexDesktopData/models'
    }

    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
    }

    const modelFilePath = path.join(
        modelsDir,
        'all-mpnet-base-v2_quantized.onnx',
    )

    if (!fs.existsSync(modelFilePath)) {
        const modelUrl =
            'https://huggingface.co/Xenova/all-mpnet-base-v2/resolve/main/onnx/model_quantized.onnx'

        const writer = fs.createWriteStream(modelFilePath)

        const response = await axios({
            url: modelUrl,
            method: 'GET',
            responseType: 'stream',
        })

        const totalLength = response.headers['content-length']

        console.log('Starting download')
        response.data.pipe(writer)

        new Promise<void>((resolve, reject) => {
            let bytesDownloaded = 0
            response.data.on('data', (chunk: string) => {
                bytesDownloaded += chunk.length
                downloadProgress = Math.floor(
                    (bytesDownloaded / totalLength) * 100,
                )

                mainWindow.webContents.send(
                    'download-progress',
                    `${downloadProgress}%`,
                )
            })

            response.data.on('end', () => {
                console.log('Download complete')
                resolve()
            })

            writer.on('error', reject)
        })
    }

    modelEnvironment.localModelPath = modelFilePath
    console.log(`Model file path1: ${modelFilePath}`)

    generateEmbeddings = await modelPipeline(
        'feature-extraction',
        'Xenova/all-mpnet-base-v2',
    )

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

    return embedTextFunction
}
// async function extractEntitiesFromText(text2analzye) {
//     return await extractEntities(text2analzye)
// }

function isPathComponentValid(component: string) {
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

expressApp.put('/add_page', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    var fullUrl = req.body.fullUrl
    var pageTitle = req.body.pageTitle
    var fullHTML = req.body.fullHTML
    var createdWhen = req.body.createdWhen
    var contentType = req.body.contentType
    var creatorId = req.body.creatorId
    var sourceApplication = req.body.sourceApplication
    var metadataJSON = ''

    try {
        await allTables.sourcesDB.run(
            `INSERT INTO webPagesTable VALUES(?, ?, ?, ?, ?, ?, ?, ? )`,
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
        )

        await indexDocument({
            fullUrl,
            pageTitle,
            fullHTML,
            createdWhen,
            contentType,
            sourceApplication,
            creatorId,
            embedTextFunction,
            allTables,
            entityExtractionFunction,
        })
        return res.status(200).send(true)
    } catch (error) {
        log.error('Error in /index_document', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

expressApp.put('/add_annotation', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    var fullUrl = req.body?.fullUrl || ''
    var pageTitle = req.body?.pageTitle || ''
    var fullHTML = req.body?.fullHTML || ''
    var createdWhen = req.body?.createdWhen || ''
    var contentType = req.body?.contentType || ''
    var creatorId = req.body?.creatorId || ''
    var sourceApplication = req.body?.sourceApplication || ''

    try {
        await sourcesDB?.run(
            `INSERT INTO annotationsTable VALUES(?, ?, ?, ?, ?, ?, ?)`,
            [
                fullUrl,
                pageTitle,
                fullHTML,
                contentType,
                createdWhen,
                sourceApplication,
                creatorId,
            ],
        )

        await indexDocument({
            fullUrl,
            pageTitle,
            fullHTML,
            createdWhen,
            contentType,
            sourceApplication,
            creatorId,
            embedTextFunction,
            allTables,
            entityExtractionFunction,
        })
        return res.status(200).send(true)
    } catch (error) {
        log.error('Error in /index_annotation', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
    // return await indexAnnotation(req);
})

expressApp.post('/get_similar', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    console.log('find_similar', embedTextFunction)
    return await findSimilar(
        req,
        res,
        embedTextFunction,
        allTables,
        entityExtractionFunction,
    )
})
expressApp.post('/load_feed_sources', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    try {
        const sourcesList = await allTables.sourcesDB.all(
            `SELECT * FROM rssSourcesTable`,
        )

        //  , function(err, rows) {
        //   if (err) {
        //     console.error(err);
        //     rturn;
        //   }

        //   console.log("rows", rows);
        const feedSourcesOutput = sourcesList.map((source: Source) => ({
            feedUrl: source.feedUrl,
            feedTitle: source.feedTitle,
            feedFavIcon: source.feedFavIcon,
            type: source.type,
        }))

        console.log('feedSources', feedSourcesOutput)
        return res.status(200).send(feedSourcesOutput)
    } catch (error) {
        console.log(`Error loading feed sources in /load_feed_sources`, error)
        return res.status(500).json({ error: error })
    }
})

interface FeedSource {
    feedUrl: string
    feedTitle: string
    type: string
}

let feedSourceQueue: FeedSource[] = []

expressApp.post('/add_feed_source', async function (req, res) {
    log.log('called add_feed_source')
    if (!checkSyncKey(req.body.syncKey)) {
        console.log('sync key not valid')
        return res.status(403).send('Only one app instance allowed')
    }
    const feedSources = req.body.feedSources
    console.log('feedSources', req.body)
    feedSourceQueue = [...feedSourceQueue, ...feedSources]

    console.log('feedSourceQueue', feedSourceQueue)
    // logic for how RSS feed is added to the database
    try {
        for (let i = 0; i < feedSources.length; i++) {
            const feedUrl = feedSources[i]?.feedUrl
            let feedTitle = feedSources[i]?.feedTitle
            const type = feedSources[i]?.type

            if (!feedTitle) {
                const response = await fetch(feedUrl)
                const data = await response.text()
                const parser = new xml2js.Parser()
                let parsedData: any = null

                parser.parseString(data, function (err, result) {
                    if (err) {
                        console.error('Failed to parse RSS feed: ', err)
                    } else {
                        parsedData = result.rss.channel[0]
                    }
                })

                if (parsedData) {
                    feedTitle = parsedData?.title[0] ?? ''
                }
            }

            if (feedUrl && feedTitle) {
                try {
                    const sql = `INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)`
                    sourcesDB?.run(sql, [
                        feedUrl,
                        feedTitle,
                        type || null,
                        null,
                    ])
                    log.log(`Added feed ${feedUrl}`)
                } catch (error) {
                    log.error('Error saving feed')
                    return
                }
            }
        }

        for (const feedSource of feedSourceQueue) {
            const { feedUrl, feedTitle, type } = feedSource

            console.log('Start indexing', feedUrl)

            await addFeedSource(
                feedUrl,
                feedTitle,
                embedTextFunction,
                allTables,
                type,
                entityExtractionFunction,
            )

            // if (success) {
            //   // TODO: Handle different outcomes
            // }
        }

        return res.status(200).send(true)
    } catch (error) {
        log.error(`Error adding feed sources in /add_rss_feed`, error)
        return res.status(500).json({ error: error })
    }
})

expressApp.get('/get_all_rss_sources', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    // logic for how RSS feed is added to the database, and the cron job is set up

    try {
        const rssSources = await getAllRSSSources(allTables)
        return res.status(200).send(rssSources)
    } catch (error) {
        log.error(`Error adding ${req.body.feedUrl} in /add_rss_feed`, error)
        return res.status(500).json({ error: error })
    }
})
expressApp.post('/remove_feed_source', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }

    try {
        const feedUrl = req.body.feedUrl
        await sourcesDB?.run(`DELETE FROM rssSourcesTable WHERE feedUrl = ?`, [
            feedUrl,
        ])
        return res.status(200).send('Feed source removed successfully')
    } catch (error) {
        log.error(
            `Error removing ${req.body.feedUrl} in /remove_feed_source`,
            error,
        )
        return res.status(500).json({ error: error })
    }

    // logic for how RSS feed is added to the database, and the cron job is set up
})

expressApp.post('/open_file', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('No access to open file')
    }

    const path = req.body.path
    if (!fs.existsSync(path)) {
        return res.status(404).send('File not found')
    }

    try {
        await shell.openExternal(path)
        return res.status(200).send('File opened successfully')
    } catch (error) {
        return res.status(500).send('Error opening file')
    }
})

expressApp.post('/fetch_all_folders', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('No access to open file')
    }
    const folders = await sourcesDB?.all(
        `SELECT * FROM watchedFoldersTable`,
        function (err: any, rows: number) {
            if (err) {
                return console.log(err.message)
            }
            // rows contains all entries in the table
            console.log(rows)
        },
    )

    console.log('folders', folders)

    return res.status(200).json(folders)
})

expressApp.post('/watch_new_folder', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('No access to open file')
    }
    const folder = await watchNewFolder()

    return res.status(200).json(folder)
})

// this is added as a global object so we can store all the watcher processes to cancel again later if needed

expressApp.post('/remove_folder_to_watch', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('No access to open file')
    }
    const body = req.body
    const id = body.id
    let originalDocument: { path: string } = (await sourcesDB?.get(
        'SELECT path FROM watchedFoldersTable WHERE id = ?',
        [id],
    )) || { path: '' }
    let watcherToKill = folderWatchers[originalDocument?.path]

    watcherToKill.close()

    await sourcesDB?.run('DELETE FROM watchedFoldersTable WHERE id = ?', [id])

    delete folderWatchers[originalDocument.path]
    return res.status(200).json({ success: true })
})

async function watchNewFolder() {
    // Shadowopen a window otherwise the folderselect will not show
    const newWindow = new BrowserWindow({
        height: 10,
        width: 10,
        transparent: true,
        frame: false,
    })
    newWindow.focus()
    newWindow.on('close', (event) => {
        event.preventDefault()
        newWindow.hide()
    })

    // select new folder
    const newFolderData = await dialog.showOpenDialog(newWindow, {
        properties: ['openDirectory'],
    })

    let newFolder = newFolderData.filePaths[0]
    newWindow.close()

    if (!newFolder) {
        return false
    }

    // determine folder type
    let sourceApplication: 'obsidian' | 'local' | 'logseq' = 'local'
    const obsidianFolder = path.join(newFolder, '.obsidian')
    const logseqFolder = path.join(newFolder, 'logseq')

    let topLevelFolder = newFolder.split('/').pop()
    if (fs.existsSync(obsidianFolder)) {
        sourceApplication = 'obsidian'
    } else if (fs.existsSync(logseqFolder)) {
        sourceApplication = 'logseq'
        newFolder = logseqFolder + '/pages'
    }

    // check if the folder is already saved
    let folders: Folder[] | undefined = []
    folders = await sourcesDB?.all(
        `SELECT * FROM watchedFoldersTable`,
        function (err: any, rows: number) {
            if (err) {
                return console.log(err.message)
            }
            // rows contains all entries in the table
            console.log(rows)
        },
    )

    var folderPaths: string[] = folders
        ? folders.map((folder: Folder) => folder.path)
        : []
    if (folderPaths.includes(newFolder)) {
        return
    }

    // if ew folder, add to database

    let result = await sourcesDB?.run(
        `INSERT INTO watchedFoldersTable(path, type) VALUES(?, ?, ?)`,
        [newFolder, sourceApplication, ''],
    )
    let id = result?.lastID

    try {
        const folder = {
            path: newFolder,
            sourceApplication: sourceApplication,
            id: id,
        }
        startWatchers([folder], allTables)
    } catch (error) {
        log.error('Error in /watch_new_folder:', error)
    }

    const newFolderObject = {
        path: newFolder,
        sourceApplication: sourceApplication,
        id: id,
    }

    return newFolderObject
}

async function startWatchers(folders: Folder[], allTables: any) {
    if (!pdfJS) {
        pdfJS = await import('pdfjs-dist')
    }

    const ignoredPathObsidian = store.get('obsidian') || null
    const ignoredPathLogseq = store.get('logseq') || null

    console.log('ignoredPathObsidian', ignoredPathObsidian)

    let deletionInProgress = false
    // take the given folderPath array and start watchers on each folder
    folders?.length > 0 &&
        folders?.forEach((folder) => {
            var watcher = chokidar.watch(folder.path, {
                ignored: [
                    /(^|[\/\\])\../, // ignore dotfiles
                    ignoredPathObsidian as string,
                    ignoredPathLogseq as string,
                ],
                persistent: true,
            })

            folderWatchers[folder.path] = watcher

            watcher.on('add', async function (path, stats) {
                // found no other way to wait for the deletion here so there are no race conditions for updated files
                let retryCount = 0
                const maxRetries = 20

                const waitForDeletion = () => {
                    return new Promise<void>((resolve, reject) => {
                        if (!deletionInProgress) {
                            resolve()
                        } else if (retryCount >= maxRetries) {
                            reject(new Error('Max retries reached'))
                        } else {
                            setTimeout(() => {
                                retryCount++
                                waitForDeletion().then(resolve).catch(reject)
                            }, 500)
                        }
                    })
                }

                try {
                    await waitForDeletion()
                    // Continue processing after deletion is complete
                } catch (error) {
                    // Handle error if max retries reached
                    console.error(error)
                }

                processingQueue = processingQueue.then(
                    async () =>
                        // rename is a deletion and re-addition in the events, no rename unfortunately
                        await processFiles(
                            path,
                            folder.sourceApplication,
                            'addOrRename',
                            pdfJS,
                        ),
                )
            })
            watcher.on('unlink', async function (path: string, stats: any) {
                console.log('Deletion of file started: ', path)
                deletionInProgress = true

                if (path.endsWith('.pdf')) {
                    const fingerPrint: { fingerPrint: string } =
                        (await sourcesDB?.get(
                            `SELECT fingerPrint FROM pdfTable WHERE path = ?`,
                            [path],
                        )) || { fingerPrint: '' }

                    await allTables.vectorDocsTable.delete(
                        `fullurl = '${fingerPrint?.fingerPrint.toString()}'`,
                    )

                    await allTables.sourcesDB.run(
                        `DELETE FROM pdfTable WHERE path = ?`,
                        [path],
                    )

                    deletionInProgress = false
                    console.log('deletion done: ', path)
                }

                if (path.endsWith('.md')) {
                    await allTables.sourcesDB.run(
                        `DELETE FROM markdownDocsTable WHERE path = ?`,
                        [path],
                    )
                    deletionInProgress = false
                }
            })
            let debounceTimers: { [path: string]: NodeJS.Timeout | null } = {}

            watcher.on('change', async function (path, stats) {
                // Clear the previous timer if it exists
                if (debounceTimers[path]) {
                    clearTimeout(debounceTimers[path]!)
                }

                // Set a new timer
                debounceTimers[path] = setTimeout(() => {
                    processingQueue = processingQueue.then(async () => {
                        await processFiles(
                            path,
                            folder.sourceApplication,
                            'contentChange',
                            pdfJS,
                        )
                        // Once the processing is done, remove the timer from the map
                        delete debounceTimers[path]
                    })
                }, 300) // 30 seconds
            })
        })
    console.log('watchers setup: ', Object.keys(folderWatchers).length)
}

async function processFiles(
    file: string,
    sourceApplication: string,
    changeType: 'addOrRename' | 'contentChange',
    pdfJS: any,
) {
    const extension = file.split('.').pop()
    if (extension === 'pdf') {
        await processPDF(file, allTables, pdfJS, embedTextFunction)
        return
    } else if (extension === 'md') {
        await processMarkdown(
            file,
            allTables,
            embedTextFunction,
            sourceApplication,
            changeType,
        )
        return
    } else if (extension === 'epub') {
    } else if (extension === 'mobi') {
    }
}

///////////////////////////
/// PKM SYNC ENDPOINTS ///
/////////////////////////

expressApp.post('/set-directory', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    let directoryPath
    let pkmSyncType
    try {
        pkmSyncType = req.body.pkmSyncType
        if (typeof pkmSyncType !== 'string') {
            res.status(400).json({ error: 'Invalid pkmSyncType' })
            return
        }
        directoryPath = pickDirectory(pkmSyncType)
        if (directoryPath) {
            store.set(pkmSyncType, directoryPath)
            res.status(200).send(directoryPath)
            return path
        } else {
            res.status(400).json({ error: 'No directory selected' })
            return null
        }
    } catch (error) {
        log.error('Error in /set-directory:', error)
        res.status(500).json({
            error: 'Internal server error',
        })
        return null
    }
})

expressApp.put('/update-file', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    try {
        var body = req.body

        var pkmSyncType = body.pkmSyncType
        var pageTitle = body.pageTitle
        var fileContent = body.fileContent

        if (
            typeof pkmSyncType !== 'string' ||
            typeof pageTitle !== 'string' ||
            typeof fileContent !== 'string'
        ) {
            res.status(400).json({ error: 'Invalid input' })
            return
        }

        var directoryPath = store.get(pkmSyncType)

        if (!directoryPath) {
            res.status(400).json({
                error: 'No directory found for given pkmSyncType',
            })
            return
        }

        var filePath = `${directoryPath}/${pageTitle}.md`
        fs.writeFileSync(filePath, fileContent)
        res.status(200).send(filePath)
    } catch (error) {
        log.error('Error in /update-file:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

expressApp.post('/get-file-content', async function (req, res) {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    try {
        var pkmSyncType = req.body.pkmSyncType
        var pageTitle = req.body.pageTitle

        if (typeof pkmSyncType !== 'string' || typeof pageTitle !== 'string') {
            res.status(400).json({ error: 'Invalid input' })
            return
        }

        var directoryPath = store.get(pkmSyncType)
        if (!directoryPath) {
            res.status(400).json({
                error: 'No directory found for given pkmSyncType',
            })
            return
        }

        var filePath = directoryPath + '/' + pageTitle + '.md'
        if (!fs.existsSync(filePath)) {
            res.status(400).json({ error: 'File not found' })
            return
        }

        var fileContent = fs.readFileSync(filePath, 'utf-8')
        res.status(200).send(fileContent)
    } catch (error) {
        log.error('Error in /get-file-content:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

///////////////////////////
/// BACKUP ENDPOINTS ///
/////////////////////////

// Exposing Server Endpoints for BACKUPS

let backupPath = ''

expressApp.post('/status', (req, res) => {
    console.log(' /status called')
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }

    res.status(200).send('running')
})
expressApp.get('/status', (req, res) => {
    console.log(' /status called')
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    res.status(200).send('running')
})

expressApp.post('/pick-directory', (req, res) => {
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
expressApp.get('/backup/location', async (req, res) => {
    if (!checkSyncKey(req.body.syncKey)) {
        res.status(403)
    } else {
        let backupPath = store.get('backupPath')
        if (!backupPath) {
            backupPath = await pickDirectory('backup')
        }
        store.set('backup', backupPath)
        res.status(200).send(backupPath)
    }
})

expressApp.get('/backup/start-change-location', async (req, res) => {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    res.status(200).send(await pickDirectory('backup'))
})

// listing files
expressApp.get('/backup/:collection', (req, res) => {
    if (!checkSyncKey(req.body.syncKey)) {
        return res.status(403).send('Only one app instance allowed')
    }
    var collection = req.params.collection
    if (!isPathComponentValid(collection)) {
        return res.status(400).send('Malformed collection parameter')
    }

    var dirpath = backupPath + `/backup/${collection}`
    try {
        let filelist = fs.readdirSync(dirpath, 'utf-8')
        filelist = filelist.filter((filename) => {
            // check if filename contains digits only to ignore system files like .DS_STORE
            return /^\d+$/.test(filename)
        })
        res.status(200).send(filelist.toString())
    } catch (err) {
        if ((err as CustomError).code === 'ENOENT') {
            res.status(404)
            res.status(404).json({ error: 'Collection not found.' })
        } else throw err
    }
})

// getting files
expressApp.get('/backup/:collection/:timestamp', (req, res) => {
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

    var filepath = backupPath + `/backup/${collection}/` + filename + '.json'
    try {
        res.status(200).send(fs.readFileSync(filepath, 'utf-8'))
    } catch (err) {
        if ((err as CustomError).code === 'ENOENT') {
            res.status(404)
            req.body = 'File not found.'
        } else throw err
    }
})

expressApp.put('/backup/:collection/:timestamp', async (req, res) => {
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

    console.log('req.body', req.body, collection)

    var dirpath = req.body.backupPath + `/backup/${collection}`
    try {
        fs.mkdirSync(dirpath, { recursive: true })
    } catch (err) {
        log.error(err)
        return res.status(500).send('Failed to create directory.')
    }

    var filepath = dirpath + `/${filename}`
    fs.writeFile(filepath, JSON.stringify(req.body), function (err) {
        if (err) {
            log.error(err)
            return res.status(500).send('Failed to write to file.')
        }
        res.status(200).send('Data saved successfully.')
    })
})
