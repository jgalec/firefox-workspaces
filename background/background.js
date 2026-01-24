/**
 * Background Controller - Window-Based Workspaces
 * Fixes: Race condition during restoration (Partial save bug).
 */

console.log('Background Controller: Service started (v4 - Restoration Lock).');

let windowToWorkspaceMap = {}; 
const restoringWindows = new Set(); // Locks windows currently being restored

async function hydrateMap() {
    const workspaces = await StorageService.getWorkspaces();
    windowToWorkspaceMap = {}; 
    const allWindows = await browser.windows.getAll();
    const openWindowIds = new Set(allWindows.map(w => w.id));

    for (const ws of workspaces) {
        if (ws.windowId && openWindowIds.has(ws.windowId)) {
            windowToWorkspaceMap[ws.windowId] = ws.id;
        } else if (ws.windowId) {
            ws.windowId = null;
            await StorageService.saveWorkspace(ws);
        }
    }
    console.log('Background: Hydrated window map', windowToWorkspaceMap);
}

/**
 * Saves the state.
 */
async function saveWindowState(windowId) {
    // 1. Block if restoring
    if (restoringWindows.has(windowId)) {
        console.log(`Background: Skipping save for window ${windowId} (Restoring in progress)`);
        return;
    }

    const workspaceId = windowToWorkspaceMap[windowId];
    if (!workspaceId) return;

    try {
        try {
            await browser.windows.get(windowId);
        } catch (e) { return; }

        const tabs = await browser.tabs.query({ windowId });
        if (tabs.length === 0) return;

        const tabData = tabs.map(t => ({
            url: t.url,
            title: t.title,
            pinned: t.pinned,
            active: t.active, 
            groupId: t.groupId
        }));

        let groupsData = [];
        if (browser.tabGroups) {
            try {
                const groups = await browser.tabGroups.query({ windowId });
                groupsData = groups.map(g => ({
                    nativeId: g.id, 
                    title: g.title,
                    color: g.color,
                    collapsed: g.collapsed
                }));
            } catch (e) { /* Ignore */ }
        }

        const groupsToStore = groupsData.map(g => {
            const tabsInGroup = tabData
                .map((t, index) => ({ ...t, index })) 
                .filter(t => t.groupId === g.nativeId)
                .map(t => t.index);
            
            return {
                title: g.title,
                color: g.color,
                collapsed: g.collapsed,
                tabIndices: tabsInGroup
            };
        });

        const workspaces = await StorageService.getWorkspaces();
        const wsIndex = workspaces.findIndex(w => w.id === workspaceId);
        
        if (wsIndex > -1) {
            workspaces[wsIndex].tabs = tabData.map(t => ({ 
                url: t.url, 
                title: t.title, 
                pinned: t.pinned,
                active: t.active 
            }));
            workspaces[wsIndex].groups = groupsToStore;
            workspaces[wsIndex].windowId = windowId; 
            
            await browser.storage.local.set({ workspaces: workspaces });
        }
    } catch (error) {
        console.warn('Background: Error saving window state', error);
    }
}

async function openWorkspaceWindow(workspaceId) {
    const workspaces = await StorageService.getWorkspaces();
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    const currentWin = await browser.windows.getCurrent();
    if (ws.windowId === currentWin.id) return;

    if (ws.windowId) {
        try {
            await browser.windows.update(ws.windowId, { focused: true });
            return;
        } catch (e) { }
    }

    // Restore
    let urls = (ws.tabs && ws.tabs.length > 0) ? ws.tabs.map(t => t.url) : null;
    
    if (urls) {
        urls = urls.filter(u => u.startsWith('http') || u.startsWith('file'));
        if (urls.length === 0) urls = null;
    }

    const createData = { focused: true };
    if (urls) createData.url = urls;

    // --- CRITICAL: Create Window but LOCK updates ---
    const newWindow = await browser.windows.create(createData);
    const newWindowId = newWindow.id;
    
    // Add lock immediately
    restoringWindows.add(newWindowId);
    console.log(`Background: Locked window ${newWindowId} for restoration.`);

    try {
        ws.windowId = newWindowId;
        windowToWorkspaceMap[newWindowId] = ws.id;
        await StorageService.saveWorkspace(ws);
        
        if (ws.tabs && urls) {
            const newTabs = await browser.tabs.query({ windowId: newWindowId });
            
            let activeTabId = null;

            // Restore Pins & Find Active
            for (let i = 0; i < Math.min(newTabs.length, ws.tabs.length); i++) {
                if (ws.tabs[i].pinned) {
                    await browser.tabs.update(newTabs[i].id, { pinned: true });
                }
                if (ws.tabs[i].active) {
                    activeTabId = newTabs[i].id;
                }
            }

            // Restore Groups
            if (ws.groups && browser.tabGroups) {
                for (const group of ws.groups) {
                    try {
                        const tabIdsToGroup = group.tabIndices
                            .map(idx => newTabs[idx] ? newTabs[idx].id : null)
                            .filter(id => id !== null);

                        if (tabIdsToGroup.length > 0) {
                            const newGroupId = await browser.tabs.group({
                                tabIds: tabIdsToGroup
                            });
                            
                            await browser.tabGroups.update(newGroupId, {
                                title: group.title,
                                color: group.color,
                                collapsed: group.collapsed
                            });
                        }
                    } catch (err) { }
                }
            }

            if (activeTabId) {
                await browser.tabs.update(activeTabId, { active: true });
            }
        }
    } finally {
        // --- RELEASE LOCK ---
        // Small delay to let final events settle
        setTimeout(() => {
            restoringWindows.delete(newWindowId);
            console.log(`Background: Unlocked window ${newWindowId}. Auto-save enabled.`);
            // Force one clean save of the final restored state
            saveWindowState(newWindowId);
        }, 1000);
    }
}

// --- Listeners ---

browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'SWITCH_WORKSPACE') {
        await openWorkspaceWindow(message.workspaceId);
        return { success: true };
    }
    if (message.type === 'CREATE_WORKSPACE') {
        const newWs = message.payload;
        newWs.tabs = [];
        newWs.groups = [];
        newWs.windowId = null; 
        await StorageService.saveWorkspace(newWs);
        await openWorkspaceWindow(newWs.id);
        return { success: true };
    }
});

const events = [
    browser.tabs.onUpdated,
    browser.tabs.onCreated,
    browser.tabs.onMoved,
    browser.tabs.onAttached,
    browser.tabs.onDetached,
    browser.tabs.onActivated
];

events.forEach(event => {
    event.addListener((arg1, arg2) => {
        let windowId = null;
        if (arg1 && arg1.windowId) windowId = arg1.windowId;
        else if (arg2 && arg2.windowId) windowId = arg2.windowId;
        else if (arg1 && typeof arg1 === 'number' && arg2 && arg2.windowId) windowId = arg2.windowId;

        if (windowId && windowToWorkspaceMap[windowId]) {
            saveWindowState(windowId);
        }
    });
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (removeInfo.isWindowClosing) return;
    if (removeInfo.windowId && windowToWorkspaceMap[removeInfo.windowId]) {
        saveWindowState(removeInfo.windowId);
    }
});

if (browser.tabGroups) {
    if (browser.tabGroups.onUpdated) {
        browser.tabGroups.onUpdated.addListener(g => {
            if (g.windowId && windowToWorkspaceMap[g.windowId]) saveWindowState(g.windowId);
        });
    }
}

browser.windows.onRemoved.addListener(async (windowId) => {
    if (windowToWorkspaceMap[windowId]) {
        const workspaceId = windowToWorkspaceMap[windowId];
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === workspaceId);
        if (ws) {
            ws.windowId = null;
            await StorageService.saveWorkspace(ws);
        }
        delete windowToWorkspaceMap[windowId];
    }
});

browser.runtime.onStartup.addListener(hydrateMap);
browser.runtime.onInstalled.addListener(hydrateMap);
hydrateMap();