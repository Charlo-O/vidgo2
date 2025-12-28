/**
 * Electron API utilities
 * Provides a unified interface for accessing Electron APIs or falling back to web alternatives
 */

// Check if running in Electron
export const isElectron = (): boolean => {
    return typeof window !== 'undefined' &&
        window.electronAPI !== undefined &&
        window.electronAPI.isElectron === true;
};

// Get the backend URL
export const getBackendUrl = async (): Promise<string> => {
    if (isElectron()) {
        try {
            const api = window.electronAPI
            if (!api) {
                throw new Error('electronAPI not available')
            }
            return await api.getBackendUrl();
        } catch {
            const host = window.location.hostname || '127.0.0.1'
            const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
            return `${protocol}//${host}:18000`
        }
    }

    // Web environment: use environment variable or default
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
    }
    const host = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1'
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:'
    return `${protocol}//${host}:18000`
};

// Get backend status
export const getBackendStatus = async (): Promise<boolean> => {
    if (isElectron()) {
        try {
            const api = window.electronAPI
            if (!api) {
                return false
            }
            return await api.getBackendStatus();
        } catch {
            return false;
        }
    }

    // In web environment, try to ping the backend
    try {
        const response = await fetch(`${await getBackendUrl()}/api/health/`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch {
        return false;
    }
};

// Restart backend (Electron only)
export const restartBackend = async (): Promise<boolean> => {
    if (isElectron()) {
        try {
            const api = window.electronAPI
            if (!api) {
                return false
            }
            return await api.restartBackend();
        } catch {
            return false;
        }
    }

    console.warn('restartBackend is only available in Electron');
    return false;
};

// Get platform info
export const getPlatform = (): string => {
    if (isElectron()) {
        return window.electronAPI?.platform || 'unknown'
    }
    return 'web';
};

// Window controls (Electron only)
export const windowControls = {
    minimize: () => {
        if (isElectron()) {
            window.electronAPI?.minimizeWindow();
        }
    },
    maximize: () => {
        if (isElectron()) {
            window.electronAPI?.maximizeWindow();
        }
    },
    close: () => {
        if (isElectron()) {
            window.electronAPI?.closeWindow();
        }
    },
};

// File selection dialogs (Electron only)
export const selectDirectory = async (): Promise<string | undefined> => {
    if (isElectron()) {
        return await window.electronAPI?.selectDirectory();
    }
    console.warn('selectDirectory is only available in Electron');
    return undefined;
};

export const selectFile = async (filters?: { name: string; extensions: string[] }[]): Promise<string | undefined> => {
    if (isElectron()) {
        return await window.electronAPI?.selectFile(filters);
    }
    console.warn('selectFile is only available in Electron');
    return undefined;
};

// Type declarations
declare global {
    interface Window {
        electronAPI?: {
            getBackendStatus: () => Promise<boolean>;
            getBackendUrl: () => Promise<string>;
            restartBackend: () => Promise<boolean>;
            platform: string;
            isElectron: boolean;
            getAppVersion: () => Promise<string>;
            selectDirectory: () => Promise<string | undefined>;
            selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | undefined>;
            minimizeWindow: () => void;
            maximizeWindow: () => void;
            closeWindow: () => void;
            onBackendStatusChange: (callback: (status: boolean) => void) => void;
            removeAllListeners: (channel: string) => void;
        };
    }
}
