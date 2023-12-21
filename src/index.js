const express = require('express')
const electron = require('electron')
const {
    app,
    BrowserWindow,
    ipcMain,
    Tray,
    Menu,
    nativeImage,
    dialog,
    Notification,
} = electron
const url = require('url')

const isPackaged = app.isPackaged
const xml2js = require('xml2js')
const autoUpdater = require('electron-updater').autoUpdater
const Store = require('electron-store')
const crypto2 = require('crypto')
const { AsyncDatabase } = require('promised-sqlite3')

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const log = require('electron-log')
const lancedb = require('vectordb')
const dotEnv = require('dotenv')
const moment = require('moment')

dotEnv.config()
const settings = require('electron-settings')

if (!isPackaged) {
    settings.configure({
        dir: path.join(electron.app.getAppPath(), 'data'),
    })
}
console.log('settings', settings.file())
const cors = require('cors')
const chokidar = require('chokidar')

// setting up settings and config files in the right folders
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

console.log('store', store.path)
// Electron App basic setup
const store = isPackaged
    ? new Store()
    : new Store({ cwd: path.join(electron.app.getAppPath(), 'data') })
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY // Must be 256 bits (32 characters)
const IV_LENGTH = 16 // For AES, this is always 16
let tray = null

console.log('isPackaged', electron.app.getAppPath())
const EXPRESS_PORT = 11922 // Different from common React port 3000 to avoid conflicts
let expressApp = express()
expressApp.use(cors({ origin: '*' }))

const { indexDocument } = require('./indexing_pipeline/index.js')
const { findSimilar } = require('./search/find_similar.js')
const {
    addFeedSource,
    getAllRSSSources,
} = require('./indexing_pipeline/rssFeeds/index.js')
// VectorTable settings
let vectorDBuri = isPackaged
    ? path.join(app.getPath('userData'), 'data/vectorDB')
    : path.join('../MemexDesktopData/vectorDB')
let sourcesDB = null
let vectorDocsTable = null
let vectorDocsTableName = 'vectordocstable'
let allTables = {
    sourcesDB: sourcesDB,
    vectorDocsTable: vectorDocsTable,
}
let mainWindow
let downloadProgress = 0
let pdfJS

////////////////////////////////
/// TRANSFORMER JS STUFF ///
////////////////////////////////
// Setup
let modelPipeline
let modelEnvironment

// embedding functions
let embedTextFunction
let generateEmbeddings
let extractEntities
let entityExtractionFunction

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

// trigger random change

var MAIN_WINDOW_WEBPACK_ENTRY = null
var MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY = null

if (require('electron-squirrel-startup')) {
    app.quit()
}

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
var server = null

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
    return new Promise((resolve, reject) => {
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
        if (error.code === 'EACCES') {
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
    return new Promise((resolve, reject) => {
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
                'src',
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
    log.info('before-quit')
    tray.destroy()
    if (server) {
        log.info('Stopping Express server as parto of quit process')
        await stopExpress()
    }
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
                pathname: path.join(
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
        await settings.set('hasOnboarded', true)
    } else {
        await initializeDatabase()
        embedTextFunction = await initializeModels()
    }
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
                'tray_icon.png',
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

async function generateEmbeddingFromText(text2embed) {
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
    console.log('dbPath', dbPath)
    sourcesDB = await AsyncDatabase.open(dbPath)
    console.log('Database initialized at: ', dbPath)
    sourcesDB = await AsyncDatabase.open(dbPath)

    // create Tables
    createRSSsourcesTable = `CREATE TABLE IF NOT EXISTS rssSourcesTable(feedUrl STRING PRIMARY KEY, feedTitle STRING, type STRING, lastSynced INTEGER)`
    createWebPagesTable = `CREATE TABLE IF NOT EXISTS webPagesTable(fullUrl STRING PRIMARY KEY, pageTitle STRING, fullHTML STRING, contentType STRING, createdWhen INTEGER, sourceApplication STRING, creatorId STRING, metaDataJSON STRING)`

    createAnnotationsTable = `CREATE TABLE IF NOT EXISTS annotationsTable(fullUrl STRING PRIMARY KEY, pageTitle STRING, fullHTML STRING, contentType STRING, createdWhen INTEGER, sourceApplication STRING, creatorId STRING)`
    createPDFTable = `CREATE TABLE IF NOT EXISTS pdfTable(id INTEGER PRIMARY KEY, path STRING, fingerPrint STRING, pageTitle STRING, extractedContent STRING, createdWhen INTEGER, sourceApplication STRING, creatorId STRING)`

    sourcesDB.run(createRSSsourcesTable, function (err) {
        if (err) {
            console.log('err', err)
        }
    })
    sourcesDB.run(createWebPagesTable, function (err) {
        if (err) {
            console.log('err', err)
        }
    })
    sourcesDB.run(createAnnotationsTable, function (err) {
        if (err) {
            console.log('err', err)
        }
    })
    sourcesDB.run(createPDFTable, function (err) {
        if (err) {
            console.log('err', err)
        }
    })

    let createIndexQuery = `CREATE INDEX IF NOT EXISTS idx_pdfTable_fingerPrint ON pdfTable(fingerPrint)`
    sourcesDB.run(createIndexQuery, function (err) {
        if (err) {
            console.log('Error creating index:', err)
        }
    })
    let createIndexQueryForPath = `CREATE INDEX IF NOT EXISTS idx_pdfTable_path ON pdfTable(path)`
    sourcesDB.run(createIndexQueryForPath, function (err) {
        if (err) {
            console.log('Error creating index:', err)
        }
    })

    let vectorDB = await lancedb.connect(vectorDBuri)
    try {
        try {
            vectorDocsTable = await vectorDB.openTable(vectorDocsTableName)
        } catch {
            if (vectorDocsTable == null) {
                function generateZeroVector(size) {
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
}

async function initializeFileSystemWatchers() {
    // starting folder watchers:
    var folderPaths = store.get('folderPaths')

    if (folderPaths) {
        startWatchers(folderPaths, allTables)
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

        new Promise((resolve, reject) => {
            let bytesDownloaded = 0
            response.data.on('data', (chunk) => {
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
async function extractEntitiesFromText(text2analzye) {
    return await extractEntities(text2analzye)
}

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

        await indexDocument(
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
        )
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
        await sourcesDB.run(
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

        await indexDocument(
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
        )
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
        const feedSourcesOutput = sourcesList.map((source) => ({
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

let feedSourceQueue = []

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
                let parsedData

                parser.parseString(data, function (err, result) {
                    if (err) {
                        console.error('Failed to parse RSS feed: ', err)
                    } else {
                        parsedData = result.rss.channel[0]
                    }
                })

                feedTitle = parsedData?.title[0] ?? ''
            }

            if (feedUrl && feedTitle) {
                try {
                    const sql = `INSERT OR REPLACE INTO rssSourcesTable VALUES (?, ?, ?, ?)`
                    sourcesDB.run(sql, [feedUrl, feedTitle, type || null, null])
                    log.log(`Added feed ${feedUrl}`)
                } catch (error) {
                    log.error('Error saving feed')
                    return
                }
            }
        }

        for (const feedSource of feedSourceQueue) {
            const { feedUrl, feedTitle, type = type || '' } = feedSource

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
        log.error(`Error adding ${feedUrl} in /add_rss_feed`, error)
        return res.status(500).json({ error: error })
    }
})
expressApp.put('/remove_rss_feed', async function (req, res) {
    // logic for how RSS feed is added to the database, and the cron job is set up
})

expressApp.post('/watch_new_folder', async function (req, res) {
    const newFolder = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    })

    if (!newFolder) {
        return res.status(500).json({ error: 'Folder selection aborted' })
    }

    store.push('folderPaths', newFolder)
    console.log(store.get('folderPaths'))
    try {
        var watcher = chokidar.watch(directoryPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
        })

        watcher.on('add', async function (path) {
            console.log('File', path, 'has been added')

            await processFiles(filesAndSubfolders)

            res.status(200).send(path)
        })

        const filesAndSubfolders = fs.readdirSync(newFolder)
        await Promise.all(filesAndSubfolders.map(processFiles))
    } catch (error) {
        log.error('Error in /watch_new_folder:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

async function watchNewFolder() {
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

    const newFolderData = await dialog.showOpenDialog(newWindow, {
        properties: ['openDirectory'],
    })

    const newFolder = newFolderData.filePaths[0]
    newWindow.close()

    if (!newFolder) {
        return false
    }

    var folderPaths = store.get('folderPaths') || []
    // if (folderPaths.includes(newFolder)) {
    //     return
    // }
    folderPaths.push(newFolder)
    folderPaths = Array.from(new Set(folderPaths))
    store.set('folderPaths', folderPaths)
    console.log(store.get('folderPaths'))
    try {
        const filesAndSubfolders = fs.readdirSync(newFolder)
        await Promise.all(filesAndSubfolders.map(processFiles))
        startWatchers([newFolder])
    } catch (error) {
        log.error('Error in /watch_new_folder:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

async function startWatchers(folders, allTables) {
    if (!pdfJS) {
        pdfJS = await import('pdfjs-dist')
    }
    // take the given folderPath array and start watchers on each folder

    folders.forEach((folder) => {
        var watcher = chokidar.watch(folder, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
        })
        watcher.on('add', async function (path, stats) {
            await processFiles(path)
        })
        watcher.on('change', async function (path, stats) {
            console.log('File', path, 'has been changed', stats)
        })
    })
}

async function processFiles(file) {
    const extension = file.split('.').pop()
    if (extension === 'pdf') {
        const test = await sourcesDB.get(
            `SELECT * FROM pdfTable WHERE path = ?`,
            [file],
        )
        if (test === undefined) {
            const pdfData = fs.readFileSync(file)
            const uint8Array = new Uint8Array(pdfData.buffer)

            const pdfDoc = await pdfJS.getDocument({ data: uint8Array }).promise
            // console.log('pdfdoc', pdfDoc)
            const fingerPrint = pdfDoc._pdfInfo.fingerprints[0]
            // console.log('pdfdoc', pdfDoc)
            const metaData = await pdfDoc.getMetadata()
            let createdWhen = metaData.info.CreationDate || null

            if (createdWhen) {
                createdWhen = moment(createdWhen).unix()
            }
            console.log('metadata', metaData)
            let title = metaData.info.Title || nullyarn

            // async function getText(pdfUrl) {
            //     var pdf = pdfDoc
            //     var maxPages = pdf._pdfInfo.numPages
            //     var countPromises = [] // collecting all page promises
            //     var textSections = []
            //     // get all pages text
            //     for (var j = 1; j <= maxPages; j++) {
            //         var page = pdf.getPage(j)
            //         countPromises.push(
            //             page.then(function (page) {
            //                 // add page promise
            //                 var textContent = page.getTextContent()
            //                 return textContent.then(function (text) {
            //                     // return content promise
            //                     return textSections.push(text.items)
            //                 })
            //             }),
            //         )
            //     }
            //     // Wait for all pages and join text
            //     return Promise.all(countPromises)
            // }

            let textSections = []
            async function getText() {
                var pdf = pdfDoc
                var maxPages = pdf._pdfInfo.numPages
                console.log('pages', maxPages)
                // get all pages text
                for (var j = 1; j <= maxPages; j++) {
                    var page = await pdf.getPage(j)

                    var textContent = await page.getTextContent()

                    textSections = [...textSections, ...textContent.items]
                }
            }

            await getText()

            let pdfText = []

            let heightCounts = {}
            textSections.forEach((textSegment) => {
                let height = textSegment.transform[0]
                if (heightCounts[height]) {
                    heightCounts[height]++
                } else {
                    heightCounts[height] = 1
                }
            })

            console.log('heightCounts', heightCounts)

            let sortedHeights = Object.keys(heightCounts).sort(
                (a, b) => heightCounts[b] - heightCounts[a],
            )

            console.log('sortedHeights', sortedHeights)

            let paragraphHeight = sortedHeights[0]
            let headingHeights = sortedHeights.slice(1)
            let smallTextHeights = headingHeights.filter((item) => {
                item < paragraphHeight
            })

            headingHeights.sort((a, b) => b - a)

            console.log('headingHeights', headingHeights)
            let textElements = {}
            textElements[paragraphHeight] = 'paragraph'
            headingHeights.forEach((height, index) => {
                textElements[height] = 'Heading' + (index + 1)
            })

            // Goal: Detect groups of text, e.g. paragraphs
            // Approach: Use the Y position of chunks as indicator if they are the same sentence and chunk those together
            // or if the previous chunk was endOf line without any ending punctuation
            // or if the previous chu
            // other ideas:
            // scan the document and find all font sizes, then group by font size, then groupb by order of appearance to find headers, subheaders, etc.
            // if next item does not have same size, then it is a new paragraph
            // create a basic JSON structure with headers and paragraphs

            let tempGroup = []

            for (let i = 0; i < textSections?.length; i++) {
                const textSegment = textSections[i]
                if (
                    // When items stop having the same font-Size, it's likely a new section or heading
                    (textSegment?.transform[0] ===
                        textSections[i - 1]?.transform[0] ||
                        textSegment?.transform[0] <= paragraphHeight) &&
                    textSegment.str !== ''
                ) {
                    if (textSegment.hasEOL) {
                        tempGroup.push(textSegment.str + ' ')
                    } else {
                        tempGroup.push(textSegment.str)
                    }
                } else {
                    let matchingTextElement =
                        textElements[textSections[i - 1]?.height]

                    const groupString = tempGroup.join('')

                    // filter out small chunks that are likely noise
                    if (groupString.length > 10) {
                        pdfText.push({
                            [matchingTextElement]: groupString,
                        })
                    }
                    if (textSegment.height !== 0) {
                        tempGroup = [textSegment.str]
                    } else {
                        tempGroup = []
                    }
                }
            }

            if (!title) {
                const firstFiveItems = pdfText.slice(0, 5)
                let lowestHeading = 'heading10'
                firstFiveItems.forEach((item) => {
                    const keys = Object.keys(item)
                    keys.forEach((key) => {
                        if (key.startsWith('Heading')) {
                            const headingNumber = parseInt(
                                key.replace('Heading', ''),
                            )
                            console.log('headingNumber', headingNumber)
                            if (
                                headingNumber <
                                parseInt(lowestHeading.replace('heading', ''))
                            ) {
                                lowestHeading = key
                                console.log('lowestHeading', lowestHeading)
                            }
                        }
                    })
                })
                title = firstFiveItems.find((item) => 'Heading2' in item)[
                    'Heading2'
                ]
            }

            console.log('pdfText', title)

            if (tempGroup.length > 0) {
                pdfText.push(tempGroup)
            }

            const existingFileViaFingerPrint = await sourcesDB.get(
                `SELECT * FROM pdfTable WHERE fingerPrint = ?`,
                [fingerPrint],
            )

            if (!existingFileViaFingerPrint) {
                // console.log('added new file: ', file)
                await allTables.sourcesDB.run(
                    `INSERT INTO pdfTable VALUES(null, ?, ?, ? ,?, ?, ?, ?)`,
                    [
                        file,
                        fingerPrint,
                        title,
                        JSON.stringify(pdfText),
                        createdWhen,
                        '',
                        '',
                    ],
                )
            } else {
                // console.log(
                //     'existingFileViaFingerPrint',
                //     existingFileViaFingerPrint,
                // )

                const existingFilePath =
                    existingFileViaFingerPrint.path.substring(
                        0,
                        existingFileViaFingerPrint.path.lastIndexOf('/'),
                    )
                const newFilePath = file.substring(0, file.lastIndexOf('/'))

                if (existingFilePath === newFilePath) {
                    console.log('this is a rename', file)
                    console.log('rename file: ', file, fingerPrint)
                    await allTables.sourcesDB.run(
                        `UPDATE pdfTable SET path = ? WHERE fingerPrint = ?`,
                        [file, fingerPrint],
                    )
                    console.log('rename done: ', file)
                }
            }
        }
    } else if (extension === 'md') {
        console.log('ismarkdown')
    } else if (extension === 'epub') {
        console.log('isEpub')
    } else if (extension === 'mobi') {
        console.log('isMobi')
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
        directoryPath = await pickDirectory(pkmSyncType)
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
        if (err.code === 'ENOENT') {
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
        if (err.code === 'ENOENT') {
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

    var dirpath = req.body.backupPath + `/backup/${collection}`
    try {
        // await mkdirp(dirpath); TODO fix
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
