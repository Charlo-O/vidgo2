import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Backend management
    getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
    getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
    restartBackend: () => ipcRenderer.invoke('restart-backend'),

    // Platform info
    platform: process.platform,
    isElectron: true,

    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // File system operations (optional, for future use)
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    selectFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('select-file', filters),

    // Window controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),

    // Event listeners
    onBackendStatusChange: (callback: (status: boolean) => void) => {
        ipcRenderer.on('backend-status-change', (_event, status) => callback(status));
    },

    // Cleanup listener
    removeAllListeners: (channel: string) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// Type declarations for the exposed API
declare global {
    interface Window {
        electronAPI: {
            getBackendStatus: () => Promise<boolean>;
            getBackendUrl: () => Promise<string>;
            restartBackend: () => Promise<boolean>;
            platform: NodeJS.Platform;
            isElectron: boolean;
            getAppVersion: () => Promise<string>;
            selectDirectory: () => Promise<string | undefined>;
            selectFile: (filters?: Electron.FileFilter[]) => Promise<string | undefined>;
            minimizeWindow: () => void;
            maximizeWindow: () => void;
            closeWindow: () => void;
            onBackendStatusChange: (callback: (status: boolean) => void) => void;
            removeAllListeners: (channel: string) => void;
        };
    }
}
