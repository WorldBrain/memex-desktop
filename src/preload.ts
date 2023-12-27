// src/preload.ts
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel: string, data: any): void => {
            ipcRenderer.send(channel, data)
        },
        on: (
            channel: string,
            func: (event: any, ...args: any[]) => void,
        ): void => {
            ipcRenderer.on(channel, func)
        },
    },
})
