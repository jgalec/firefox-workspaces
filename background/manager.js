/**
 * Workspace Manager
 * Core business logic for handling workspace persistence and restoration.
 */

const WorkspaceManager = {
    normalizeUrl(url) {
        if (!url) return 'about:newtab';
        if (url === 'about:blank') return 'about:newtab';
        return url;
    },

    buildTabSignature(tabs) {
        return tabs
            .map(t => `${this.normalizeUrl(t.url)}|${t.pinned ? 1 : 0}|${t.cookieStoreId || 'firefox-default'}`)
            .join('||');
    },

    /**
     * Re-builds the memory map from storage on startup.
     */
    async hydrateMap() {
        const workspaces = await StorageService.getWorkspaces();
        StateManager.resetMap();
        
        const allWindows = await browser.windows.getAll();
        const openWindowIds = new Set(allWindows.map(w => w.id));

        const linkedWorkspaceIds = new Set();

        for (const ws of workspaces) {
            if (ws.windowId && openWindowIds.has(ws.windowId)) {
                StateManager.linkWindow(ws.windowId, ws.id);
                linkedWorkspaceIds.add(ws.id);
                // Restore Badge via Event
                EventBus.emit(Events.WINDOW_LINKED, { windowId: ws.windowId, workspaceId: ws.id });
            } else if (ws.windowId) {
                // Window closed externally
                ws.windowId = null;
                await StorageService.saveWorkspace(ws);
            }
        }

        // Re-link restored session windows when windowId changed between sessions.
        const workspaceBySignature = new Map();
        for (const ws of workspaces) {
            if (linkedWorkspaceIds.has(ws.id)) continue;
            if (!ws.tabs || ws.tabs.length === 0) continue;

            const signature = this.buildTabSignature(ws.tabs);
            if (signature && !workspaceBySignature.has(signature)) {
                workspaceBySignature.set(signature, ws);
            }
        }

        for (const win of allWindows) {
            const hasLink = !!StateManager.getWorkspaceId(win.id);
            if (hasLink) continue;

            const tabs = await browser.tabs.query({ windowId: win.id });
            if (!tabs || tabs.length === 0) continue;

            const signature = this.buildTabSignature(tabs);
            const matchedWorkspace = workspaceBySignature.get(signature);
            if (!matchedWorkspace) continue;

            matchedWorkspace.windowId = win.id;
            await StorageService.saveWorkspace(matchedWorkspace);
            StateManager.linkWindow(win.id, matchedWorkspace.id);
            linkedWorkspaceIds.add(matchedWorkspace.id);
            workspaceBySignature.delete(signature);
            EventBus.emit(Events.WINDOW_LINKED, { windowId: win.id, workspaceId: matchedWorkspace.id });
            Logger.debug(`Manager: Re-linked restored window ${win.id} to workspace ${matchedWorkspace.id}`);
        }

        Logger.debug('Manager: Hydrated window map', StateManager.windowToWorkspaceMap);
    },

    /**
     * Saves the current state of a window to its workspace.
     */
    async saveWindowState(windowId) {
        // 1. Check Locks
        if (StateManager.isLocked(windowId)) {
            Logger.debug(`Manager: Skipping save for window ${windowId} (Locked)`);
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
                groupId: t.groupId,
                cookieStoreId: t.cookieStoreId
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
                    active: t.active,
                    cookieStoreId: t.cookieStoreId
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
        const newWindow = await browser.windows.create({ focused: true });
        const newWindowId = newWindow.id;
        
        const initialTabs = await browser.tabs.query({ windowId: newWindowId });
        const initialTabId = initialTabs.length > 0 ? initialTabs[0].id : null;

        StateManager.lockWindow(newWindowId);

        try {
            ws.windowId = newWindowId;
            StateManager.linkWindow(newWindowId, ws.id);
            await StorageService.saveWorkspace(ws);
            
            EventBus.emit(Events.WORKSPACE_OPENED, { windowId: newWindowId, workspace: ws });

            if (ws.tabs && ws.tabs.length > 0) {
                const createdTabIds = [];

                for (let i = 0; i < ws.tabs.length; i++) {
                    const t = ws.tabs[i];
                    let url = t.url;
                    
                    if (!url || (!url.startsWith('http') && !url.startsWith('file') && !url.startsWith('about'))) {
                        url = 'about:newtab';
                    }

                    let newTab = null;
                    try {
                        // Pinned tabs cannot be discarded in Firefox API
                        const isDiscarded = !t.active && !t.pinned;
                        const createOptions = {
                            windowId: newWindowId,
                            pinned: t.pinned || false,
                            active: t.active || false,
                            index: i,
                            discarded: isDiscarded
                        };

                        if (isDiscarded) {
                            createOptions.title = t.title || 'Loading...';
                        }

                        // Firefox throws "Illegal URL" if about:newtab is passed explicitly
                        if (url && url !== 'about:newtab') {
                            createOptions.url = url;
                        }

                        if (t.cookieStoreId && t.cookieStoreId !== 'firefox-default') {
                            createOptions.cookieStoreId = t.cookieStoreId;
                        }

                        newTab = await browser.tabs.create(createOptions);
                    } catch (err) {
                        if (t.cookieStoreId && t.cookieStoreId !== 'firefox-default') {
                            try {
                                console.warn(`Manager: Container ${t.cookieStoreId} invalid. Falling back.`);
                                const isDiscardedFallback = !t.active && !t.pinned;
                                const fallbackOptions = {
                                    windowId: newWindowId,
                                    url: url !== 'about:newtab' ? url : undefined,
                                    pinned: t.pinned || false,
                                    active: t.active || false,
                                    index: i,
                                    discarded: isDiscardedFallback
                                };

                                if (isDiscardedFallback) {
                                    fallbackOptions.title = t.title || 'Loading...';
                                }

                                newTab = await browser.tabs.create(fallbackOptions);
                            } catch (e2) {
                                console.error('Manager: Failed to restore tab (fallback)', e2);
                            }
                        } else {
                            console.error('Manager: Failed to restore tab', err);
                        }
                    }
                    createdTabIds.push(newTab ? newTab.id : null);
                }

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
                        } catch (err) { console.error('Manager: Group restore error', err); }
                    }
                }
            }
        } finally {
            setTimeout(() => {
                StateManager.unlockWindow(newWindowId);
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
                ws.windowId = null; 
                await StorageService.saveWorkspace(ws);
            }
            StateManager.unlinkWindow(windowId);
            Logger.debug(`Manager: Window ${windowId} closed. Workspace ${workspaceId} marked inactive.`);
        }
    },

    /**
     * Converts the current unmanaged window into a managed workspace.
     */
    async captureExistingWindow(workspaceId) {
        const currentWin = await browser.windows.getCurrent();
        if (!currentWin) return;

        Logger.debug(`Manager: Capturing window ${currentWin.id} for workspace ${workspaceId}`);
        // Link immediately in memory
        StateManager.linkWindow(currentWin.id, workspaceId);

        EventBus.emit(Events.WINDOW_LINKED, { windowId: currentWin.id, workspaceId });
        
        // Force a direct save logic here to ensure initial population
        
        try {
            const tabs = await browser.tabs.query({ windowId: currentWin.id });
            const tabData = tabs.map(t => ({
                url: t.url,
                title: t.title,
                pinned: t.pinned,
                active: t.active,
                groupId: t.groupId,
                cookieStoreId: t.cookieStoreId
            }));

            const workspaces = await StorageService.getWorkspaces();
            const wsIndex = workspaces.findIndex(w => w.id === workspaceId);
            
            if (wsIndex > -1) {
                workspaces[wsIndex].tabs = tabData.map(t => ({ 
                    url: t.url, 
                    title: t.title, 
                    pinned: t.pinned,
                    active: t.active,
                    cookieStoreId: t.cookieStoreId
                }));
                workspaces[wsIndex].windowId = currentWin.id;
                
                await browser.storage.local.set({ workspaces: workspaces });
                Logger.debug(`Manager: Captured ${tabData.length} tabs.`);
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
            
            EventBus.emit(Events.WORKSPACE_UPDATED, { workspace: ws });
        }
    }
};
