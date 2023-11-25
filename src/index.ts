import express from "express";
import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import { autoUpdater } from "electron-updater";

import { dialog } from "electron";
import Store from "electron-store";
import crypto from "crypto";

const log = require("electron-log");
const lancedb = require("vectordb");
require("dotenv").config();
const settings = require("electron-settings");
const cors = require("cors");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

const store = new Store();

var fs = require("fs");
var mkdirp = require("mkdirp");
var path = require("path");

// VectorTable settings
const uri = "data/sample-lancedb";
let databaseTable = null;
let db = null;
let pipelineObject = null;
const embed_fun = {};
const tableName = "recommendations_table";

let tray: Tray = null;

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

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require("electron-squirrel-startup")) {
  app.quit();
}

const EXPRESS_PORT = 11922; // Different from common React port 3000 to avoid conflicts
const expressApp = express();

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

// Example route 3: Any other functionality you want to add
let server: ReturnType<typeof expressApp.listen> | null = null;

const startExpress = (): void => {
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
};

function encrypt(text: string) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const key = iv.toString("hex") + ":" + encrypted.toString("hex");

  return key;
}

function decrypt(text: string) {
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

const checkSyncKey = (inputKey: string): boolean => {
  const store = new Store();
  const storedKey: string = store.get("syncKey") as string;

  if (!storedKey) {
    store.set("syncKey", encrypt(inputKey));
    return true;
  } else if (decrypt(storedKey) === inputKey) {
    return true;
  } else {
    return false;
  }
};

const stopExpress = (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
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
};

const pickDirectory = (type: "backup" | "obsidian" | "logseq") => {
  try {
    const directories = dialog.showOpenDialogSync({
      properties: ["openDirectory"],
    });
    if (directories && directories.length > 0) {
      const path = directories[0];

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
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.openDevTools();
};

app.on("before-quit", async (event) => {
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
    let trayIconPath;

    if (process.env.NODE_ENV === "development") {
      trayIconPath = path.join(__dirname, "/img/tray_icon.png");
    } else {
      trayIconPath = path.join(process.resourcesPath, "img", "tray_icon.png");
    }
    const trayIcon = nativeImage.createFromPath(trayIconPath);

    if (!fs.existsSync(trayIconPath)) {
      log.error("Tray icon not found:", trayIconPath);
      return;
    }

    tray = new Tray(trayIcon);
    tray.setImage(trayIcon);

    let updateMenuItem: Electron.MenuItemConstructorOptions = {
      label: "Check for Updates",
      click: () => {
        autoUpdater.checkForUpdates();
      },
    };

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Memex Local Sync - v${app.getVersion()}`,
        enabled: false, // This makes the menu item non-clickable
      },
      {
        label: "Start on Startup",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin, // Check if the app is set to start on login
        click: (item) => {
          const startOnStartup = item.checked;
          app.setLoginItemSettings({ openAtLogin: startOnStartup });
        },
      },
      {
        label: "Refresh Sync Key",
        click: () => {
          store.delete("syncKey");
        },
      },
      updateMenuItem,
      {
        label: "Exit",
        click: () => {
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
        .then((result) => {})
        .catch((err) => {
          log.error("err", err);
        });
      autoUpdater.on("update-available", async () => {
        log.info("update available");
        log.info(autoUpdater.downloadUpdate());
      });

      autoUpdater.on("update-downloaded", () => {
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

  let table = null;
  db = await lancedb.connect(uri);
  try {
    table = await db.openTable(tableName);
    databaseTable = table;
  } catch {}
});

app.on("activate", () => {
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

// Exposing Server Endpoints for PKM SYNC

expressApp.post("/set-directory", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  let directoryPath;
  let pkmSyncType: "obsidian" | "logseq" | "backup";
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

expressApp.put("/update-file", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  try {
    const body = req.body;

    const pkmSyncType = body.pkmSyncType;
    const pageTitle = body.pageTitle;
    const fileContent = body.fileContent;

    if (
      typeof pkmSyncType !== "string" ||
      typeof pageTitle !== "string" ||
      typeof fileContent !== "string"
    ) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    let directoryPath = store.get(pkmSyncType);

    if (!directoryPath) {
      res
        .status(400)
        .json({ error: "No directory found for given pkmSyncType" });
      return;
    }

    const filePath = `${directoryPath}/${pageTitle}.md`;
    fs.writeFileSync(filePath, fileContent);
    res.status(200).send(filePath);
  } catch (error) {
    log.error("Error in /update-file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

expressApp.post("/get-file-content", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  try {
    const pkmSyncType = req.body.pkmSyncType;
    const pageTitle = req.body.pageTitle;

    if (typeof pkmSyncType !== "string" || typeof pageTitle !== "string") {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    let directoryPath = store.get(pkmSyncType);
    if (!directoryPath) {
      res
        .status(400)
        .json({ error: "No directory found for given pkmSyncType" });
      return;
    }

    const filePath = `${directoryPath}/${pageTitle}.md`;
    if (!fs.existsSync(filePath)) {
      res.status(400).json({ error: "File not found" });
      return;
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    res.status(200).send(fileContent);
  } catch (error) {
    log.error("Error in /get-file-content:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

expressApp.put("/index_document", async (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  try {
    const embeddedContent = await embedContent(req.body.originalContent);

    const documentToIndex = [
      {
        sourceApplication: "Memex",
        createdWhen: req.body.createdWhen,
        userId: req.body.userId,
        normalizedUrl: req.body.normalizedUrl,
        contentType: req.body.contentType,
        originalContent: req.body.originalContent,
        vector: embeddedContent,
      },
    ];

    if (!databaseTable) {
      databaseTable = await db.createTable(tableName, documentToIndex);
    } else {
      databaseTable.add(documentToIndex);
    }
    res.status(200).send(true);
  } catch (error) {
    log.error("Error in /index_document", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
expressApp.post("/find_similar", async (req, res) => {
  console.log("testtttttt");
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }

  console.log("findSimilar");
  try {
    const vectorQuery = await embedContent(req.body.contentText);

    console.log("vector", vectorQuery);
    const result = await databaseTable
      .search(vectorQuery)
      .limit(10)
      .execute();

    console.log("resul", result);

    res.status(200).send(result);
  } catch (error) {
    log.error("Error in /index_document", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

expressApp.use(cors());

async function embedContent(content) {
  // You need to provide an OpenAI API key
  const apiKey = "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";
  // The embedding function will create embeddings for the 'text' column

  const url = "https://api.openai.com/v1/embeddings";

  console.log("content", content.length);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: content,
      }),
    });
  } catch (error) {
    console.error("Error in /dfdf", error);
    throw new Error(`Error: ${error.status}`);
  }

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }

  const data = await response.json();

  const vectors = data.data[0].embedding;

  console.log("data", vectors);
  return vectors;
}

// function embeddingFunction(){

//   if (!pipelineObject){
//     const { pipeline } = await import('@xenova/transformers')
//     pipelineObject = pipeline
//   }
//   const pipe = await pipelineObject('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

//   embed_fun.sourceColumn = 'text'
//   embed_fun.embed = async function (batch) {
//       let result = []
//       // Given a batch of strings, we will use the `pipe` function to get
//       // the vector embedding of each string.
//       for (let text of batch) {
//           // 'mean' pooling and normalizing allows the embeddings to share the
//           // same length.
//           const res = await pipe(text, { pooling: 'mean', normalize: true })
//           result.push(Array.from(res['data']))
//       }
//       return (result)
//   }

// }

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
    const directoryPath = pickDirectory("backup");
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
  const collection = res.params.collection;
  if (!isPathComponentValid(collection)) {
    return res.throw("Malformed collection parameter", 400);
  }

  const dirpath = backupPath + `/backup/${collection}`;
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
      res.body = "Collection not found.";
    } else throw err;
  }
});

// getting files
expressApp.get("/backup/:collection/:timestamp", (req, res) => {
  if (!checkSyncKey(req.body.syncKey)) {
    res.status(404);
    return;
  }
  const filename = req.params.timestamp;
  if (!isPathComponentValid(filename)) {
    return res.throw("Malformed timestamp parameter", 400);
  }

  const collection = req.params.collection;
  if (!isPathComponentValid(collection)) {
    return res.throw("Malformed collection parameter", 400);
  }

  const filepath = backupPath + `/backup/${collection}/` + filename;
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
  const filename = req.params.timestamp;
  if (!isPathComponentValid(filename)) {
    return res.status(400).send("Malformed timestamp parameter");
  }

  const collection = req.params.collection;
  if (!isPathComponentValid(collection)) {
    return res.status(400).send("Malformed collection parameter");
  }

  const dirpath = req.body.backupPath + `/backup/${collection}`;
  try {
    await mkdirp(dirpath);
  } catch (err) {
    log.error(err);
    return res.status(500).send("Failed to create directory.");
  }

  const filepath = dirpath + `/${filename}`;
  fs.writeFile(filepath, JSON.stringify(req.body), function(err) {
    if (err) {
      log.error(err);
      return res.status(500).send("Failed to write to file.");
    }
    res.status(200).send("Data saved successfully.");
  });
});
