/**
 * Workspace Manager
 * Core business logic for handling workspace persistence and restoration.
 */

const WorkspaceManager = {
    /**
     * Re-builds the memory map from storage on startup.
     */
    async hydrateMap() {
        const workspaces = await StorageService.getWorkspaces();
        StateManager.resetMap();
        
        const allWindows = await browser.windows.getAll();
        const openWindowIds = new Set(allWindows.map(w => w.id));

        for (const ws of workspaces) {
            if (ws.windowId && openWindowIds.has(ws.windowId)) {
                StateManager.linkWindow(ws.windowId, ws.id);
            } else if (ws.windowId) {
                // Window closed externally
                ws.windowId = null;
                await StorageService.saveWorkspace(ws);
            }
        }
        console.log('Manager: Hydrated window map', StateManager.windowToWorkspaceMap);
    },

    /**
     * Saves the current state of a window to its workspace.
     */
    async saveWindowState(windowId) {
        // 1. Check Locks
        if (StateManager.isLocked(windowId)) {
            console.log(`Manager: Skipping save for window ${windowId} (Locked)`);
            return;
        }

        const workspaceId = StateManager.getWorkspaceId(windowId);
        if (!workspaceId) return;

        try {
            // Verify existence
            try { await browser.windows.get(windowId); } catch (e) { return; }

            const tabs = await browser.tabs.query({ windowId });
            if (tabs.length === 0) return;

            const tabData = tabs.map(t => ({
                url: t.url,
                title: t.title,
                pinned: t.pinned,
                active: t.active,
                groupId: t.groupId
            }));

            // Capture Groups
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

            // Link Tabs to Groups
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
            console.warn('Manager: Error saving window state', error);
        }
    },

    /**
     * Opens or restores a workspace window.
     */
    async openWorkspace(workspaceId) {
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === workspaceId);
        if (!ws) return;

        const currentWin = await browser.windows.getCurrent();
        if (ws.windowId === currentWin.id) return;

        if (ws.windowId) {
            try {
                await browser.windows.update(ws.windowId, { focused: true });
                return;
            } catch (e) { /* Stale ID */ }
        }

        // --- Create & Lock ---
        // Create basic window first. We will populate it manually to support atomic Pinned state.
        const newWindow = await browser.windows.create({ focused: true });
        const newWindowId = newWindow.id;
        
        // Grab the initial blank tab to remove later
        const initialTabs = await browser.tabs.query({ windowId: newWindowId });
        const initialTabId = initialTabs.length > 0 ? initialTabs[0].id : null;

        StateManager.lockWindow(newWindowId);

        try {
            ws.windowId = newWindowId;
            StateManager.linkWindow(newWindowId, ws.id);
            await StorageService.saveWorkspace(ws);

            if (ws.tabs && ws.tabs.length > 0) {
                const createdTabIds = [];

                for (let i = 0; i < ws.tabs.length; i++) {
                    const t = ws.tabs[i];
                    let url = t.url;
                    
                    // Basic sanity check
                    if (!url || (!url.startsWith('http') && !url.startsWith('file') && !url.startsWith('about'))) {
                        url = 'about:newtab';
                    }

                    try {
                        // Create tab with correct Pinned state immediately
                        const newTab = await browser.tabs.create({
                            windowId: newWindowId,
                            url: url,
                            pinned: t.pinned || false,
                            active: t.active || false,
                            index: i
                        });
                        createdTabIds.push(newTab.id);
                    } catch (err) {
                        console.error('Manager: Failed to restore tab', err);
                        createdTabIds.push(null); // Keep index alignment for groups
                    }
                }

                // Remove the initial blank tab
                if (initialTabId) {
                    browser.tabs.remove(initialTabId).catch(() => {});
                }

                // Restore Groups
                if (ws.groups && browser.tabGroups) {
                    for (const group of ws.groups) {
                        try {
                            const tabIdsToGroup = group.tabIndices
                                .map(idx => createdTabIds[idx])
                                .filter(id => id);

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
                        } catch (err) { console.error(err); }
                    }
                }
            }
        } finally {
            // --- Unlock ---
            setTimeout(() => {
                StateManager.unlockWindow(newWindowId);
                // Final save to sync state
                this.saveWindowState(newWindowId);
            }, 1000);
        }
    },

    /**
     * Handles window closure logic.
     */
    async handleWindowRemoved(windowId) {
        const workspaceId = StateManager.getWorkspaceId(windowId);
        if (workspaceId) {
            const workspaces = await StorageService.getWorkspaces();
            const ws = workspaces.find(w => w.id === workspaceId);
            if (ws) {
                ws.windowId = null; // Mark closed
                await StorageService.saveWorkspace(ws);
            }
            StateManager.unlinkWindow(windowId);
            console.log(`Manager: Window ${windowId} closed. Workspace ${workspaceId} marked inactive.`);
        }
    },

    /**
     * Converts the current unmanaged window into a managed workspace.
     */
    async captureExistingWindow(workspaceId) {
        const currentWin = await browser.windows.getCurrent();
        if (!currentWin) return;

        console.log(`Manager: Capturing window ${currentWin.id} for workspace ${workspaceId}`);

        // Link immediately in memory
        StateManager.linkWindow(currentWin.id, workspaceId);
        
        // Force a direct save logic here to ensure initial population
        // (Reusing saveWindowState might fail if async timing is off with storage)
        try {
            const tabs = await browser.tabs.query({ windowId: currentWin.id });
            const tabData = tabs.map(t => ({
                url: t.url,
                title: t.title,
                pinned: t.pinned,
                active: t.active,
                groupId: t.groupId
            }));

            const workspaces = await StorageService.getWorkspaces();
            const wsIndex = workspaces.findIndex(w => w.id === workspaceId);
            
            if (wsIndex > -1) {
                workspaces[wsIndex].tabs = tabData.map(t => ({ 
                    url: t.url, 
                    title: t.title, 
                    pinned: t.pinned,
                    active: t.active 
                }));
                workspaces[wsIndex].windowId = currentWin.id;
                
                await browser.storage.local.set({ workspaces: workspaces });
                console.log(`Manager: Captured ${tabData.length} tabs.`);
            }
        } catch (e) {
            console.error('Manager: Failed to capture window state', e);
        }
    },

    /**
     * Updates workspace metadata (name, color).
     */
    async updateWorkspace(id, data) {
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === id);
        if (ws) {
            if (data.name) ws.name = data.name;
            if (data.color) ws.color = data.color;
            await StorageService.saveWorkspace(ws);
        }
    }
};
