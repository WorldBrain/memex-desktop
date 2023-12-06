const express = require("express");
const electron = require("electron");
const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  dialog,
} = electron;
const autoUpdater = require("electron-updater").autoUpdater;
const Store = require("electron-store");
const crypto2 = require("crypto");

const sqlite3 = require("sqlite3").verbose();

const log = require("electron-log");
const lancedb = require("vectordb");
const dotEnv = require("dotenv");
dotEnv.config();
const settings = require("electron-settings");
const cors = require("cors");

// Electron App basic setup
const fs = require("fs");
const path = require("path");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16
const store = new Store();
let tray = null;
const EXPRESS_PORT = 11922; // Different from common React port 3000 to avoid conflicts
let expressApp = express();
expressApp.use(cors());

const { indexDocument } = require("./indexing_pipeline/index.js");
const { findSimilar } = require("./search/find_similar.js");
const {
  addRSSFeedSource,
  getAllRSSSources,
} = require("./indexing_pipeline/rssFeeds/index.js");
// VectorTable settings
let vectorDBuri = "data/vectorDB";
let sourcesDB = null;
let vectorDocsTable = null;
let vectorDocsTableName = "vectordocstable";
let allTables = {
  sourcesDB: sourcesDB,
  vectorDocsTable: vectorDocsTable,
};

////////////////////////////////
/// TRANSFORMER JS STUFF ///
////////////////////////////////
// Setup
let modelPipeline;
let modelEnvironment;

// embedding functions
let generateEmbeddings;
let embedTextFunction;

////////////////////////////////
/// ELECTRON APP BASIC SETUP ///
////////////////////////////////

if (app.dock) {
  // Check if the dock API is available (macOS specific)
  app.dock.hide();
}

if (!settings.has("userPref.startOnStartup")) {
  settings.set("userPref.startOnStartup", true);
  app.setLoginItemSettings({
    openAtLogin: true,
  });
}

var MAIN_WINDOW_WEBPACK_ENTRY = null;
var MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY = null;

if (require("electron-squirrel-startup")) {
  app.quit();
}

expressApp.use(express.json({ limit: "50mb" })); // adjust the limit as required
expressApp.use(express.urlencoded({ extended: true, limit: "50mb" })); // adjust the limit as required

process.on("uncaughtException", (err) => {
  log.error("There was an uncaught error", err);
});

process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Example route 1: Simple Hello World
expressApp.get("/hello", (req, res) => {
  res.send("Hello World from Electron's Express server!");
});

// Example route 2: Send back query params
expressApp.get("/echo", (req, res) => {
  res.json(req.query);
});

// Example route 3other functionality you want to add
var server = null;

function startExpress() {
  if (!server || !server.listening) {
    server = expressApp.listen(EXPRESS_PORT, () => {
      log.info(`Express server started on http://localhost:${EXPRESS_PORT}`);
      console.log(`Express server started on http://localhost:${EXPRESS_PORT}`);
    });
    server.keepAliveTimeout = 300000000000000000;
    server.timeout = 0;

    server.on("close", () => {
      console.log("Express server has shut down");
      log.info("Express server has shut down");
    });
  } else {
    console.log(
      `Express server is already running on http://localhost:${EXPRESS_PORT}`
    );
  }
}

function encrypt(text) {
  var iv = crypto2.randomBytes(IV_LENGTH);
  var cipher = crypto2.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  var encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  var key = iv.toString("hex") + ":" + encrypted.toString("hex");

  return key;
}

function decrypt(text) {
  var textParts = text.split(":");
  var iv = Buffer.from(textParts.shift(), "hex");
  var encryptedText = Buffer.from(textParts.join(":"), "hex");
  var decipher = crypto2.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

function checkSyncKey(inputKey) {
  return true;
  var store = new Store();
  var storedKey = store.get("syncKey");

  if (!storedKey) {
    store.set("syncKey", encrypt(inputKey));
    return true;
  } else if (decrypt(storedKey) === inputKey) {
    return true;
  } else {
    return false;
  }
}

function stopExpress() {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err) => {
        if (err) {
          log.error("Error stopping Express server:", err);
          reject(err);
        } else {
          console.log("Express server stopped.");
          server = null; // Nullify the server
          resolve();
        }
        process.exit(0);
      });
    } else {
      resolve();
    }
  });
}

function pickDirectory(type) {
  try {
    var directories = dialog.showOpenDialogSync({
      properties: ["openDirectory"],
    });
    if (directories && directories.length > 0) {
      var path = directories[0];

      store.set(type, path);

      return path; // Return the first selected directory
    }
  } catch (error) {
    if (error.code === "EACCES") {
      dialog.showErrorBox(
        "Permission Denied",
        "You do not have permission to access this directory. Please select a different directory or change your permission settings."
      );
    } else {
      dialog.showErrorBox(
        "An error occurred",
        "An error occurred while selecting the directory. Please try again."
      );
    }
    log.error(error);
  }
  return null;
}

function createWindow() {
  var mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.openDevTools();
}

app.on("before-quit", async function() {
  log.info("before-quit");
  tray.destroy();
  if (server) {
    log.info("Stopping Express server as parto of quit process");
    await stopExpress();
  }
});

app.on("ready", async () => {
  try {
    startExpress(); // Start Express server first

    log.catchErrors();
    let trayIconPath = null;

    if (process.env.NODE_ENV === "development") {
      trayIconPath = path.join(__dirname, "src/img/tray_icon.png");
    } else {
      trayIconPath = path.join(
        electron.app.getAppPath(),
        "src",
        "img",
        "tray_icon.png"
      );
    }
    var trayIcon = nativeImage.createFromPath(trayIconPath);

    if (!fs.existsSync(trayIconPath)) {
      log.error("Tray icon not found:", trayIconPath);
      return;
    }

    tray = new Tray(trayIcon);
    tray.setImage(trayIcon);

    var updateMenuItem = {
      label: "Check for Updates",
      click: function() {
        autoUpdater.checkForUpdates();
      },
    };

    var contextMenu = Menu.buildFromTemplate([
      {
        label: `Memex Local Sync - v${app.getVersion()}`,
        enabled: false, // This makes the menu item non-clickable
      },
      {
        label: "Start on Startup",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin, // Check if the app is set to start on login
        click: function(item) {
          var startOnStartup = item.checked;
          app.setLoginItemSettings({ openAtLogin: startOnStartup });
        },
      },
      {
        label: "Refresh Sync Key",
        click: function() {
          store.delete("syncKey");
        },
      },
      updateMenuItem,
      {
        label: "Exit",
        click: function() {
          console.log("exit clicked before");
          app.quit();
          console.log("exit clicked");
        },
      },
    ]);

    // Set the context menu to the Tray
    tray.setContextMenu(contextMenu);

    // Optional: Add a tooltip to the Tray
    tray.setToolTip("Memex Local Sync Helper");
    try {
      autoUpdater
        .checkForUpdates()
        .then(function() {})
        .catch(function(err) {
          log.error("err", err);
        });
      autoUpdater.on("update-available", async function() {
        log.info("update available");
        log.info(autoUpdater.downloadUpdate());
      });

      autoUpdater.on("update-downloaded", function() {
        log.info("update downloaded");
        autoUpdater.quitAndInstall();
      });
    } catch (error) {
      console.log("error", error);
    }
  } catch (error) {
    log.error("error", error);
    app.quit();
  }

  // prepare model, needs to be on highest level to be consistent in chunking size for vectors
  let { pipeline, env } = await import("@xenova/transformers");

  modelPipeline = pipeline;
  modelEnvironment = env;
  modelEnvironment.allowLocalModels = true;
  // modelEnvironment.allowRemoteModels = false;
  modelEnvironment.localModelPath = "./models/model.onnx";

  generateEmbeddings = await modelPipeline(
    "feature-extraction",
    "Xenova/all-mpnet-base-v2"
  );

  embedTextFunction = await generateEmbeddingFromText;

  // setting up all databases and tables

  const dbPath = "./data/sourcesDB.db";

  if (!fs.existsSync(dbPath)) {
    var sourcesDB = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (err) => {
        if (err) {
          console.error("Error creating the sourcesDB DB", err);
        }
      }
    );
  } else {
    var sourcesDB = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READWRITE,
      (err) => {
        if (err) {
          console.error("Error opening the sourcesDB DB", err);
        }
      }
    );
  }

  // create Tables
  createRSSsourcesTable = `CREATE TABLE IF NOT EXISTS rssSourcesTable(feedUrl STRING PRIMARY KEY, feedTitle STRING, isSubstack BOOLEAN, lastIndexed INTEGER)`;
  createWebPagesTable = `CREATE TABLE IF NOT EXISTS webPagesTable(fullUrl STRING PRIMARY KEY, createdWhen INTEGER, pageTitle STRING, fullHTML STRING, sourceApplication STRING, creatorId STRING)`;
  createAnnotationsTable = `CREATE TABLE IF NOT EXISTS annotationsTable(fullUrl STRING PRIMARY KEY, pageTitle STRING, fullHTML STRING, contentType STRING, createdWhen INTEGER, sourceApplication STRING, creatorId STRING)`;

  sourcesDB.run(createRSSsourcesTable, function(err) {
    if (err) {
      console.log("err", err);
    }
  });
  sourcesDB.run(createWebPagesTable, function(err) {
    if (err) {
      console.log("err", err);
    }
  });
  sourcesDB.run(createAnnotationsTable, function(err) {
    if (err) {
      console.log("err", err);
    }
  });

  let vectorDB = await lancedb.connect(vectorDBuri);
  try {
    try {
      vectorDocsTable = await vectorDB.openTable(vectorDocsTableName);
    } catch {
      if (vectorDocsTable == null) {
        function generateZeroVector(size) {
          return new Array(size).fill(0);
        }

        let defaultVectorDocument = {
          fullurl: "null",
          pagetitle: "null",
          sourceapplication: "null",
          createdwhen: 0,
          creatorid: "null",
          contenttype: "null",
          contenttext: "null",
          vector: generateZeroVector(768),
        };

        vectorDocsTable = await vectorDB.createTable(vectorDocsTableName, [
          defaultVectorDocument,
        ]);
      }
    }

    if ((await vectorDocsTable.countRows()) === 0) {
      vectorDocsTable.add([defaultVectorDocument]);
    }
  } catch (error) {
    console.log("error", error);
  }
  allTables = {
    sourcesDB: sourcesDB,
    vectorDocsTable: vectorDocsTable,
  };
});

async function generateEmbeddingFromText(text2embed) {
  return await generateEmbeddings(text2embed, {
    pooling: "mean",
    normalize: true,
  });
}

app.on("activate", function() {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Helper Functions for server endpoints and file select

function isPathComponentValid(component) {
  if (typeof component !== "string" || !component.match(/^[a-z0-9\-]{2,20}$/)) {
    return false;
  } else {
    return true;
  }
}
///////////////////////////
/// RABBIT HOLE ENDPOINTS ///
/////////////////////////

expressApp.put("/add_page", async function(req, res) {
  var fullUrl = req.body.fullUrl;
  var pageTitle = req.body.pageTitle;
  var fullHTML = req.body.fullHTML;
  var createdWhen = req.body.createdWhen;
  var contentType = req.body.contentType;
  var creatorId = req.body.creatorId;
  var sourceApplication = req.body.sourceApplication;

  try {
    await new Promise((resolve, reject) => {
      allTables.sourcesDB.run(
        `INSERT INTO webPagesTable VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [
          fullUrl,
          pageTitle,
          fullHTML,
          contentType,
          createdWhen,
          sourceApplication,
          creatorId,
        ],
        function(err) {
          if (err) {
            console.log("err", err); // 'statement' failed: UNIQUE constraint failed: pagesTable._id
            return reject(err);
          }
          resolve();
        }
      );
    });

    await indexDocument(
      fullUrl,
      pageTitle,
      fullHTML,
      createdWhen,
      contentType,
      sourceApplication,
      creatorId,
      embedTextFunction,
      allTables
    );
    return res.status(200).send(true);
  } catch (error) {
    log.error("Error in /index_document", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

expressApp.put("/add_annotation", async function(req, res) {
  var fullUrl = req.body.fullUrl;
  var pageTitle = req.body.pageTitle;
  var fullHTML = req.body.fullHTML;
  var createdWhen = req.body.createdWhen;
  var contentType = req.body.contentType;
  var creatorId = req.body.creatorId;
  var sourceApplication = req.body.sourceApplication;

  try {
    await new Promise((resolve, reject) => {
      allTables.sourcesDB.run(
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
        function(err) {
          if (err) {
            console.log("err", err); // 'statement' failed: UNIQUE constraint failed: pagesTable._id
            return reject(err);
          }
          resolve();
        }
      );
    });

    await indexDocument(
      fullUrl,
      pageTitle,
      fullHTML,
      createdWhen,
      contentType,
      sourceApplication,
      creatorId,
      embedTextFunction,
      allTables
    );
    return res.status(200).send(true);
  } catch (error) {
    log.error("Error in /index_document", error);
    return res.status(500).json({ error: "Internal server error" });
  }
  // return await indexAnnotation(req);
});

expressApp.post("/get_similar", async function(req, res) {
  return await findSimilar(req, res, embedTextFunction, allTables);
});

expressApp.post("/add_rss_feed_source", async function(req, res) {
  const feedUrl = req.body.feedUrl;
  const isSubstack = req.body.isSubstack;

  // logic for how RSS feed is added to the database, and the cron job is set up
  try {
    await addRSSFeedSource(feedUrl, embedTextFunction, allTables, isSubstack);
    return res.status(200).send(true);
  } catch (error) {
    log.error(`Error adding ${feedUrl} in /add_rss_feed`, error);
    return res.status(500).json({ error: error });
  }
});

expressApp.get("/get_all_rss_sources", async function(req, res) {
  // logic for how RSS feed is added to the database, and the cron job is set up

  try {
    const rssSources = await getAllRSSSources(allTables);
    return res.status(200).send(rssSources);
  } catch (error) {
    log.error(`Error adding ${feedUrl} in /add_rss_feed`, error);
    return res.status(500).json({ error: error });
  }
});
expressApp.put("/remove_rss_feed", async function(req, res) {
  // logic for how RSS feed is added to the database, and the cron job is set up
});
///////////////////////////
/// PKM SYNC ENDPOINTS ///
/////////////////////////

expressApp.post("/set-directory", async function(req, res) {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  let directoryPath;
  let pkmSyncType;
  try {
    pkmSyncType = req.body.pkmSyncType;
    if (typeof pkmSyncType !== "string") {
      res.status(400).json({ error: "Invalid pkmSyncType" });
      return;
    }
    directoryPath = await pickDirectory(pkmSyncType);
    if (directoryPath) {
      store.set(pkmSyncType, directoryPath);
      res.status(200).send(directoryPath);
      return path;
    } else {
      res.status(400).json({ error: "No directory selected" });
      return null;
    }
  } catch (error) {
    log.error("Error in /set-directory:", error);
    res.status(500).json({
      error: "Internal server error",
    });
    return null;
  }
});

expressApp.put("/update-file", async function(req, res) {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  try {
    var body = req.body;

    var pkmSyncType = body.pkmSyncType;
    var pageTitle = body.pageTitle;
    var fileContent = body.fileContent;

    if (
      typeof pkmSyncType !== "string" ||
      typeof pageTitle !== "string" ||
      typeof fileContent !== "string"
    ) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    var directoryPath = store.get(pkmSyncType);

    if (!directoryPath) {
      res
        .status(400)
        .json({ error: "No directory found for given pkmSyncType" });
      return;
    }

    var filePath = `${directoryPath}/${pageTitle}.md`;
    fs.writeFileSync(filePath, fileContent);
    res.status(200).send(filePath);
  } catch (error) {
    log.error("Error in /update-file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

expressApp.post("/get-file-content", async function(req, res) {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  try {
    var pkmSyncType = req.body.pkmSyncType;
    var pageTitle = req.body.pageTitle;

    if (typeof pkmSyncType !== "string" || typeof pageTitle !== "string") {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    var directoryPath = store.get(pkmSyncType);
    if (!directoryPath) {
      res
        .status(400)
        .json({ error: "No directory found for given pkmSyncType" });
      return;
    }

    var filePath = directoryPath + "/" + pageTitle + ".md";
    if (!fs.existsSync(filePath)) {
      res.status(400).json({ error: "File not found" });
      return;
    }

    var fileContent = fs.readFileSync(filePath, "utf-8");
    res.status(200).send(fileContent);
  } catch (error) {
    log.error("Error in /get-file-content:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

///////////////////////////
/// BACKUP ENDPOINTS ///
/////////////////////////

// Exposing Server Endpoints for BACKUPS

let backupPath = "";

expressApp.get("/status", (req, res) => {
  res.status(200).send("running");
});

expressApp.post("/pick-directory", (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  try {
    var directoryPath = pickDirectory("backup");
    if (directoryPath) {
      res.json({ path: directoryPath });
      res.status(200).send(directoryPath);
    } else {
      res.status(400).json({ error: "No directory selected" });
    }
  } catch (error) {
    log.error("Error in /pick-directory:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// get the backup folder location
expressApp.get("/backup/location", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(500);
  } else {
    let backupPath = store.get("backupPath");
    if (!backupPath) {
      backupPath = await pickDirectory("backup");
    }
    store.set("backup", backupPath);
    res.status(200).send(backupPath);
  }
});

expressApp.get("/backup/start-change-location", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  res.status(200).send(await pickDirectory("backup"));
});

// listing files
expressApp.get("/backup/:collection", (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  var collection = req.params.collection;
  if (!isPathComponentValid(collection)) {
    return res.status(400).send("Malformed collection parameter");
  }

  var dirpath = backupPath + `/backup/${collection}`;
  try {
    let filelist = fs.readdirSync(dirpath, "utf-8");
    filelist = filelist.filter((filename) => {
      // check if filename contains digits only to ignore system files like .DS_STORE
      return /^\d+$/.test(filename);
    });
    res.status(200).send(filelist.toString());
  } catch (err) {
    if (err.code === "ENOENT") {
      res.status(404);
      res.status(404).json({ error: "Collection not found." });
    } else throw err;
  }
});

// getting files
expressApp.get("/backup/:collection/:timestamp", (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  var filename = req.params.timestamp;
  if (!isPathComponentValid(filename)) {
    return res.status(400).send("Malformed timestamp parameter");
  }

  var collection = req.params.collection;
  if (!isPathComponentValid(collection)) {
    return res.status(400).send("Malformed collection parameter");
  }

  var filepath = backupPath + `/backup/${collection}/` + filename;
  try {
    res.status(200).send(fs.readFileSync(filepath, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      res.status(404);
      req.body = "File not found.";
    } else throw err;
  }
});

expressApp.put("/backup/:collection/:timestamp", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(500);
    return;
  }
  var filename = req.params.timestamp;
  if (!isPathComponentValid(filename)) {
    return res.status(400).send("Malformed timestamp parameter");
  }

  var collection = req.params.collection;
  if (!isPathComponentValid(collection)) {
    return res.status(400).send("Malformed collection parameter");
  }

  var dirpath = req.body.backupPath + `/backup/${collection}`;
  try {
    // await mkdirp(dirpath); TODO fix
  } catch (err) {
    log.error(err);
    return res.status(500).send("Failed to create directory.");
  }

  var filepath = dirpath + `/${filename}`;
  fs.writeFile(filepath, JSON.stringify(req.body), function(err) {
    if (err) {
      log.error(err);
      return res.status(500).send("Failed to write to file.");
    }
    res.status(200).send("Data saved successfully.");
  });
});
