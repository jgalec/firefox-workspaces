/**
 * Background Entry Point
 * Coordinators events and delegates logic to WorkspaceManager.
 */

Logger.debug('Background: Event Coordinator started.');
Logger.trace('boot', 'background-loaded', { version: browser.runtime.getManifest().version });

function generateWorkspaceId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return `ws-${globalThis.crypto.randomUUID()}`;
    }

    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// --- Messaging ---
browser.runtime.onMessage.addListener(async (message) => {
    Logger.trace('msg', 'received', {
        type: message.type,
        workspaceId: message.workspaceId,
        fromCurrentWindow: message.fromCurrentWindow,
        payload: message.payload
            ? { id: message.payload.id, name: message.payload.name, color: message.payload.color }
            : null
    });

    if (message.type === 'SWITCH_WORKSPACE') {
        await WorkspaceManager.openWorkspace(message.workspaceId);
        Logger.trace('msg', 'handled', { type: message.type });
        return { success: true };
    }
    if (message.type === 'CREATE_WORKSPACE') {
        const newWs = message.payload;
        const requestedId = newWs.id;
        // Securely generate a new ID to prevent overwriting existing workspaces
        newWs.id = generateWorkspaceId();
        newWs.tabs = [];
        newWs.groups = [];
        newWs.windowId = null;
        Logger.trace('msg', 'create-workspace', { requestedId, assignedId: newWs.id, name: newWs.name });
        await StorageService.saveWorkspace(newWs);
        await MenusManager.updateSubmenus(); // Refresh context menu

        // Use the flag to decide if we open a NEW window or use the CURRENT one
        if (message.fromCurrentWindow) {
            Logger.trace('msg', 'create-path', { path: 'capture-current-window', workspaceId: newWs.id });
            await WorkspaceManager.captureExistingWindow(newWs.id);
        } else {
            Logger.trace('msg', 'create-path', { path: 'open-new-window', workspaceId: newWs.id });
            await WorkspaceManager.openWorkspace(newWs.id);
        }
        Logger.trace('msg', 'handled', { type: message.type, workspaceId: newWs.id });
        return { success: true };
    }
    if (message.type === 'DELETE_WORKSPACE') {
        Logger.debug(`Background: Deleting workspace ${message.workspaceId}`);
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === message.workspaceId);
        Logger.trace('msg', 'delete-workspace', {
            workspaceId: message.workspaceId,
            found: !!ws,
            linkedWindowId: ws ? ws.windowId : null
        });

        // Unlink immediately to prevent auto-save resurrection during close
        if (ws && ws.windowId) {
            StateManager.unlinkWindow(ws.windowId);
            try { await browser.windows.remove(ws.windowId); } catch (e) {
                Logger.trace('msg', 'delete-window-remove-failed', { windowId: ws.windowId, error: e });
            }
        }

        await StorageService.deleteWorkspace(message.workspaceId);
        await MenusManager.updateSubmenus();
        Logger.trace('msg', 'handled', { type: message.type, workspaceId: message.workspaceId });
        return { success: true };
    }
    if (message.type === 'UPDATE_WORKSPACE') {
        if (message.workspaceId === 'import_destructive') {
            Logger.debug('Background: Destructive import detected. Re-hydrating...');
            Logger.trace('msg', 'update-branch', { branch: 'import_destructive' });
            await WorkspaceManager.hydrateMap();
            await MenusManager.updateSubmenus();
        } else {
            Logger.debug(`Background: Updating workspace ${message.workspaceId}`);
            Logger.trace('msg', 'update-branch', { branch: 'update-metadata', workspaceId: message.workspaceId });
            await WorkspaceManager.updateWorkspace(message.workspaceId, message.payload);
            await MenusManager.updateSubmenus();
        }
        Logger.trace('msg', 'handled', { type: message.type, workspaceId: message.workspaceId });
        return { success: true };
    }

    Logger.trace('msg', 'unhandled-type', { type: message.type });
});

// --- Auto-Save Listeners ---
// Entries are [name, event]; the name is only used for tracing.
const tabEvents = [
    ['tabs.onUpdated', browser.tabs.onUpdated],
    ['tabs.onCreated', browser.tabs.onCreated],
    ['tabs.onMoved', browser.tabs.onMoved],
    ['tabs.onAttached', browser.tabs.onAttached],
    ['tabs.onDetached', browser.tabs.onDetached],
    ['tabs.onActivated', browser.tabs.onActivated]
];

// Tracing helper: summarizes an event argument without changing it.
function describeEventArg(arg) {
    if (arg === null || arg === undefined || typeof arg !== 'object') return arg;
    return { keys: Object.keys(arg).slice(0, 12), id: arg.id, windowId: arg.windowId };
}

tabEvents.forEach(([eventName, event]) => {
    event.addListener((arg1, arg2, arg3) => {
        let windowId = null;
        if (arg1 && arg1.windowId) windowId = arg1.windowId;
        else if (arg2 && arg2.windowId) windowId = arg2.windowId;
        else if (arg1 && typeof arg1 === 'number' && arg2 && arg2.windowId) windowId = arg2.windowId;

        // arg3 is only traced (tabs.onUpdated passes the tab as its third argument); it is not used for logic.
        Logger.trace('tabs', 'event', {
            event: eventName,
            arg1: describeEventArg(arg1),
            arg2: describeEventArg(arg2),
            arg3: describeEventArg(arg3),
            resolvedWindowId: windowId,
            saveRequested: !!windowId
        });

        if (windowId) {
            WorkspaceManager.saveWindowState(windowId);
        }
    });
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    Logger.trace('tabs', 'event', {
        event: 'tabs.onRemoved',
        tabId,
        removeInfo,
        saveRequested: !removeInfo.isWindowClosing && !!removeInfo.windowId
    });
    if (removeInfo.isWindowClosing) return;
    if (removeInfo.windowId) {
        WorkspaceManager.saveWindowState(removeInfo.windowId);
    }
});

// Groups Support
if (browser.tabGroups && browser.tabGroups.onUpdated) {
    browser.tabGroups.onUpdated.addListener(g => {
        Logger.trace('tabs', 'event', { event: 'tabGroups.onUpdated', groupId: g.id, windowId: g.windowId, saveRequested: !!g.windowId });
        if (g.windowId) WorkspaceManager.saveWindowState(g.windowId);
    });
} else {
    Logger.trace('boot', 'tabGroups-unavailable');
}

// Window Closure
browser.windows.onRemoved.addListener((windowId) => {
    Logger.trace('windows', 'onRemoved', { windowId, mappedWorkspaceId: StateManager.getWorkspaceId(windowId) || null });
    WorkspaceManager.handleWindowRemoved(windowId);
});

// --- Initialization ---
let bootstrapPromise = null;

function initializeExtension() {
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async () => {
        Logger.trace('boot', 'initialize-start');
        await WorkspaceManager.hydrateMap();
        await MenusManager.init();
        IndicatorManager.init();
        Logger.trace('boot', 'initialize-done');
    })();

    return bootstrapPromise;
}

browser.runtime.onStartup.addListener(() => {
    Logger.trace('boot', 'onStartup');
    initializeExtension();
});

browser.runtime.onInstalled.addListener((details) => {
    Logger.trace('boot', 'onInstalled', { reason: details && details.reason });
    initializeExtension();
});

// Initial run
initializeExtension();
