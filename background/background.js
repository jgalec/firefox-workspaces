/**
 * Background Entry Point
 * Coordinators events and delegates logic to WorkspaceManager.
 */

console.log('Background: Event Coordinator started.');

// --- Messaging ---
browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'SWITCH_WORKSPACE') {
        await WorkspaceManager.openWorkspace(message.workspaceId);
        return { success: true };
    }
    if (message.type === 'CREATE_WORKSPACE') {
        const newWs = message.payload;
        newWs.tabs = [];
        newWs.groups = [];
        newWs.windowId = null; 
        await StorageService.saveWorkspace(newWs);
        await WorkspaceManager.openWorkspace(newWs.id);
        return { success: true };
    }
    if (message.type === 'DELETE_WORKSPACE') {
        console.log(`Background: Deleting workspace ${message.workspaceId}`);
        // 1. Close associated window if open
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === message.workspaceId);
        if (ws && ws.windowId) {
            try { await browser.windows.remove(ws.windowId); } catch (e) {}
        }
        // 2. Delete from storage
        await StorageService.deleteWorkspace(message.workspaceId);
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
browser.runtime.onStartup.addListener(() => WorkspaceManager.hydrateMap());
browser.runtime.onInstalled.addListener(() => WorkspaceManager.hydrateMap());

// Initial run
WorkspaceManager.hydrateMap();
