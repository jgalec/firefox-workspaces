/**
 * Background Entry Point
 * Coordinators events and delegates logic to WorkspaceManager.
 */

Logger.debug('Background: Event Coordinator started.');

function generateWorkspaceId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return `ws-${globalThis.crypto.randomUUID()}`;
    }

    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// --- Messaging ---
browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'SWITCH_WORKSPACE') {
        await WorkspaceManager.openWorkspace(message.workspaceId);
        return { success: true };
    }
    if (message.type === 'CREATE_WORKSPACE') {
        const newWs = message.payload;
        // Securely generate a new ID to prevent overwriting existing workspaces
        newWs.id = generateWorkspaceId();
        newWs.tabs = [];
        newWs.groups = [];
        newWs.windowId = null; 
        await StorageService.saveWorkspace(newWs);
        await MenusManager.updateSubmenus(); // Refresh context menu
        
        // Use the flag to decide if we open a NEW window or use the CURRENT one
        if (message.fromCurrentWindow) {
            await WorkspaceManager.captureExistingWindow(newWs.id);
        } else {
            await WorkspaceManager.openWorkspace(newWs.id);
        }
        return { success: true };
    }
    if (message.type === 'DELETE_WORKSPACE') {
        Logger.debug(`Background: Deleting workspace ${message.workspaceId}`);
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === message.workspaceId);
        
        // Unlink immediately to prevent auto-save resurrection during close
        if (ws && ws.windowId) {
            StateManager.unlinkWindow(ws.windowId);
            try { await browser.windows.remove(ws.windowId); } catch (e) {}
        }
        
        await StorageService.deleteWorkspace(message.workspaceId);
        await MenusManager.updateSubmenus(); 
        return { success: true };
    }
    if (message.type === 'UPDATE_WORKSPACE') {
        if (message.workspaceId === 'import_destructive') {
            Logger.debug('Background: Destructive import detected. Re-hydrating...');
            await WorkspaceManager.hydrateMap();
            await MenusManager.updateSubmenus();
        } else {
            Logger.debug(`Background: Updating workspace ${message.workspaceId}`);
            await WorkspaceManager.updateWorkspace(message.workspaceId, message.payload);
            await MenusManager.updateSubmenus();
        }
        return { success: true };
    }
});

// --- Auto-Save Listeners ---
const tabEvents = [
    browser.tabs.onUpdated,
    browser.tabs.onCreated,
    browser.tabs.onMoved,
    browser.tabs.onAttached,
    browser.tabs.onDetached,
    browser.tabs.onActivated
];

tabEvents.forEach(event => {
    event.addListener((arg1, arg2) => {
        let windowId = null;
        if (arg1 && arg1.windowId) windowId = arg1.windowId;
        else if (arg2 && arg2.windowId) windowId = arg2.windowId;
        else if (arg1 && typeof arg1 === 'number' && arg2 && arg2.windowId) windowId = arg2.windowId;

        if (windowId) {
            WorkspaceManager.saveWindowState(windowId);
        }
    });
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (removeInfo.isWindowClosing) return;
    if (removeInfo.windowId) {
        WorkspaceManager.saveWindowState(removeInfo.windowId);
    }
});

// Groups Support
if (browser.tabGroups && browser.tabGroups.onUpdated) {
    browser.tabGroups.onUpdated.addListener(g => {
        if (g.windowId) WorkspaceManager.saveWindowState(g.windowId);
    });
}

// Window Closure
browser.windows.onRemoved.addListener((windowId) => {
    WorkspaceManager.handleWindowRemoved(windowId);
});

// --- Initialization ---
browser.runtime.onStartup.addListener(() => {
    WorkspaceManager.hydrateMap();
    MenusManager.init();
    IndicatorManager.init();
});
browser.runtime.onInstalled.addListener(() => {
    WorkspaceManager.hydrateMap();
    MenusManager.init();
    IndicatorManager.init();
});

// Initial run
WorkspaceManager.hydrateMap();
MenusManager.init();
IndicatorManager.init();
