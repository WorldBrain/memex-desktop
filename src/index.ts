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
    ipcMain,
} from 'electron'
import url from 'url'
import pkg from 'electron-updater'
const { autoUpdater } = pkg

import Store from 'electron-store'
import fs from 'fs'
import path from 'path'
import log from 'electron-log'
// import * as lancedb from 'vectordb'
import dotEnv from 'dotenv'
import cors from 'cors'
import { Server } from 'http'
dotEnv.config()

const isPackaged = app.isPackaged
let updateStage: 'pristine' | 'checking' | 'downloading' | string = 'pristine'
let tray: Tray | null = null
let mainWindow: BrowserWindow
// let downloadProgress: number = 0

let EXPRESS_PORT: number
if (isPackaged) {
    EXPRESS_PORT = 11922 // Different from common React port 3000 to avoid conflicts
} else {
    EXPRESS_PORT = 11923 // Different from common React port 3000 to avoid conflicts
}
let expressApp: express.Express = express()
expressApp.use(cors({ origin: '*' }))

ipcMain.handle('get-db-path', () => {
    return path.join(app.getPath('userData'))
})

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
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: true,
            },
        })

        let indexPath
        if (isPackaged) {
            indexPath = path.join(
                electron.app.getAppPath(),
                'build',
                'index.html',
            )
        } else {
            indexPath = path.join(
                electron.app.getAppPath(),
                'src',
                'index.html',
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
        await settings.set('onboardedAfterRabbitHoleRemove', true)
        await createWindow()
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
        await settings.set('hasOnboarded', true)
    }
    const oldUser = await settings.get('onboardedAfterRabbitHoleRemove')
    if (oldUser === undefined) {
    }

    try {
        startExpress() // Start Express server first

        log.catchErrors()
        let trayIconPath = ''
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

        let updateLabel = 'Check for Updates'

        if (updateStage === 'checking') {
            updateLabel = 'Checking for Updates'
        }
        if (updateStage === 'downloading') {
            updateLabel = 'Update Downloading'
        }

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
                .then(function () {
                    updateStage = 'checking'
                })
                .catch(function (err) {
                    log.error('err', err)
                })
            autoUpdater.on('update-available', async function () {
                log.info('update available')
                updateStage = 'downloading'
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
