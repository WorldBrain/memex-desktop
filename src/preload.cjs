// src/preload.ts
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: function (channel, data) {
            ipcRenderer.send(channel, data)
        },
        on: function (channel, func) {
            ipcRenderer.on(channel, func)
        },
        getDbPath: async function () {
            return await ipcRenderer.invoke('get-db-path')
        },
    },
})
