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

    normalizeSingleActiveTab(tabs) {
        if (!Array.isArray(tabs) || tabs.length === 0) return [];

        const normalizedTabs = tabs.map(tab => ({ ...tab, active: !!tab.active }));
        const activeIndices = normalizedTabs
            .map((tab, index) => (tab.active ? index : -1))
            .filter(index => index !== -1);

        if (activeIndices.length === 1) return normalizedTabs;

        const fallbackIndex = activeIndices.length > 1
            ? activeIndices[0]
            : normalizedTabs.findIndex(tab => !tab.pinned);

        const finalActiveIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
        return normalizedTabs.map((tab, index) => ({
            ...tab,
            active: index === finalActiveIndex
        }));
    },

    normalizeGroupColor(color) {
        const allowedColors = new Set(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);
        return typeof color === 'string' && allowedColors.has(color) ? color : 'blue';
    },

    normalizeGroupTitle(title) {
        if (typeof title !== 'string') return 'Group';
        const trimmed = title.trim();
        return trimmed.length > 0 ? trimmed.slice(0, 120) : 'Group';
    },

    /**
     * Re-builds the memory map from storage on startup.
     */
    async hydrateMap() {
        const workspaces = await StorageService.getWorkspaces();
        StateManager.resetMap();
        
        const allWindows = await browser.windows.getAll();
        const openWindowIds = new Set(allWindows.map(w => w.id));

        Logger.trace('hydrate', 'start', {
            workspaces: workspaces.map(w => ({ id: w.id, name: w.name, windowId: w.windowId, tabCount: (w.tabs || []).length })),
            openWindowIds
        });

        const linkedWorkspaceIds = new Set();

        for (const ws of workspaces) {
            if (ws.windowId && openWindowIds.has(ws.windowId)) {
                StateManager.linkWindow(ws.windowId, ws.id);
                linkedWorkspaceIds.add(ws.id);
                // Restore Badge via Event
                EventBus.emit(Events.WINDOW_LINKED, { windowId: ws.windowId, workspaceId: ws.id });
            } else if (ws.windowId) {
                // Window closed externally
                Logger.trace('hydrate', 'stale-window-cleared', { workspaceId: ws.id, staleWindowId: ws.windowId });
                ws.windowId = null;
                await StorageService.saveWorkspace(ws);
            }
        }

        // Re-link restored session windows when windowId changed between sessions.
        // Safety rule: only auto-link when signature is unique on both sides.
        const workspacesBySignature = new Map();
        for (const ws of workspaces) {
            if (linkedWorkspaceIds.has(ws.id)) continue;
            if (!ws.tabs || ws.tabs.length === 0) continue;

            const signature = this.buildTabSignature(ws.tabs);
            if (!signature) continue;

            if (!workspacesBySignature.has(signature)) {
                workspacesBySignature.set(signature, []);
            }
            workspacesBySignature.get(signature).push(ws);
        }

        const windowsBySignature = new Map();
        for (const win of allWindows) {
            const hasLink = !!StateManager.getWorkspaceId(win.id);
            if (hasLink) continue;

            const tabs = await browser.tabs.query({ windowId: win.id });
            if (!tabs || tabs.length === 0) continue;

            const signature = this.buildTabSignature(tabs);
            if (!signature) continue;

            if (!windowsBySignature.has(signature)) {
                windowsBySignature.set(signature, []);
            }
            windowsBySignature.get(signature).push(win.id);
        }

        for (const [signature, wsList] of workspacesBySignature.entries()) {
            const winList = windowsBySignature.get(signature) || [];
            if (wsList.length !== 1 || winList.length !== 1) {
                Logger.trace('hydrate', 'relink-skipped', {
                    workspaceIds: wsList.map(w => w.id),
                    windowIds: winList,
                    reason: (wsList.length > 0 && winList.length > 0) ? 'ambiguous-signature' : 'no-counterpart'
                });
                if (wsList.length > 0 && winList.length > 0) {
                    Logger.debug(
                        `Manager: Skipping ambiguous restore link for signature (workspaces=${wsList.length}, windows=${winList.length})`
                    );
                }
                continue;
            }

            const matchedWorkspace = wsList[0];
            const windowId = winList[0];
            matchedWorkspace.windowId = windowId;
            await StorageService.saveWorkspace(matchedWorkspace);
            StateManager.linkWindow(windowId, matchedWorkspace.id);
            linkedWorkspaceIds.add(matchedWorkspace.id);
            EventBus.emit(Events.WINDOW_LINKED, { windowId, workspaceId: matchedWorkspace.id });
            Logger.trace('hydrate', 'relinked-by-signature', { workspaceId: matchedWorkspace.id, windowId });
            Logger.debug(`Manager: Re-linked restored window ${windowId} to workspace ${matchedWorkspace.id}`);
        }

        Logger.trace('hydrate', 'done', { windowToWorkspaceMap: StateManager.windowToWorkspaceMap, linkedWorkspaceIds });
        Logger.debug('Manager: Hydrated window map', StateManager.windowToWorkspaceMap);
    },

    /**
     * Saves the current state of a window to its workspace.
     */
    async saveWindowState(windowId) {
        Logger.trace('save', 'start', { windowId });

        // 1. Check Locks
        if (StateManager.isLocked(windowId)) {
            Logger.trace('save', 'skipped', { windowId, reason: 'window-locked' });
            Logger.debug(`Manager: Skipping save for window ${windowId} (Locked)`);
            return;
        }

        const workspaceId = StateManager.getWorkspaceId(windowId);
        if (!workspaceId) {
            Logger.trace('save', 'skipped', { windowId, reason: 'window-not-linked-to-workspace' });
            return;
        }

        try {
            // Verify existence
            try { await browser.windows.get(windowId); } catch (e) {
                Logger.trace('save', 'skipped', { windowId, workspaceId, reason: 'window-no-longer-exists', error: e });
                return;
            }

            const tabs = await browser.tabs.query({ windowId });
            if (tabs.length === 0) {
                Logger.trace('save', 'skipped', { windowId, workspaceId, reason: 'no-tabs-in-window' });
                return;
            }

            const tabData = this.normalizeSingleActiveTab(tabs.map(t => ({
                url: t.url,
                title: t.title,
                pinned: t.pinned,
                active: t.active,
                groupId: t.groupId,
                cookieStoreId: t.cookieStoreId
            })));

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

            Logger.trace('save', 'snapshot', {
                windowId,
                workspaceId,
                tabs: tabData.map(t => ({ url: t.url, pinned: t.pinned, active: t.active, cookieStoreId: t.cookieStoreId })),
                groups: groupsToStore
            });

            await StorageService.mutateWorkspaces((workspaces) => {
                const wsIndex = workspaces.findIndex(w => w.id === workspaceId);
                if (wsIndex === -1) {
                    Logger.trace('save', 'workspace-missing-in-storage', { windowId, workspaceId });
                    return workspaces;
                }

                workspaces[wsIndex].tabs = tabData.map(t => ({
                    url: t.url,
                    title: t.title,
                    pinned: t.pinned,
                    active: t.active,
                    cookieStoreId: t.cookieStoreId
                }));
                workspaces[wsIndex].groups = groupsToStore;
                workspaces[wsIndex].windowId = windowId;
                return workspaces;
            });
            Logger.trace('save', 'done', { windowId, workspaceId, tabCount: tabData.length });
        } catch (error) {
            Logger.trace('save', 'failed', { windowId, workspaceId, error });
            console.warn('Manager: Error saving window state', error);
        }
    },

    /**
     * Opens or restores a workspace window.
     */
    async openWorkspace(workspaceId) {
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === workspaceId);
        if (!ws) {
            Logger.trace('open', 'aborted', { workspaceId, reason: 'workspace-not-found' });
            return;
        }

        const currentWin = await browser.windows.getCurrent();
        Logger.trace('open', 'start', {
            workspaceId,
            name: ws.name,
            storedWindowId: ws.windowId,
            currentWindowId: currentWin.id,
            storedTabCount: (ws.tabs || []).length,
            storedTabs: (ws.tabs || []).map(t => ({ url: t.url, pinned: t.pinned, active: t.active, cookieStoreId: t.cookieStoreId }))
        });
        if (ws.windowId === currentWin.id) {
            Logger.trace('open', 'aborted', { workspaceId, reason: 'already-the-current-window' });
            return;
        }

        if (ws.windowId) {
            try {
                await browser.windows.update(ws.windowId, { focused: true });
                Logger.trace('open', 'focused-existing-window', { workspaceId, windowId: ws.windowId });
                return;
            } catch (e) {
                /* Stale ID */
                Logger.trace('open', 'stale-window-id', { workspaceId, windowId: ws.windowId, error: e });
            }
        }

        // --- Create & Lock ---
        const newWindow = await browser.windows.create({ focused: true });
        const newWindowId = newWindow.id;
        
        const initialTabs = await browser.tabs.query({ windowId: newWindowId });
        const initialTabId = initialTabs.length > 0 ? initialTabs[0].id : null;

        StateManager.lockWindow(newWindowId);
        Logger.trace('open', 'window-created-and-locked', { workspaceId, newWindowId, initialTabId });

        try {
            ws.windowId = newWindowId;
            StateManager.linkWindow(newWindowId, ws.id);
            await StorageService.saveWorkspace(ws);
            
            EventBus.emit(Events.WORKSPACE_OPENED, { windowId: newWindowId, workspace: ws });

            if (ws.tabs && ws.tabs.length > 0) {
                const tabsToRestore = this.normalizeSingleActiveTab(ws.tabs);
                const createdTabIds = [];

                for (let i = 0; i < tabsToRestore.length; i++) {
                    const t = tabsToRestore[i];
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

                        Logger.trace('open', 'tab-create', { workspaceId, index: i, requestedUrl: t.url, options: createOptions });
                        newTab = await browser.tabs.create(createOptions);
                        Logger.trace('open', 'tab-created', { workspaceId, index: i, tabId: newTab && newTab.id, url: newTab && newTab.url, discarded: newTab && newTab.discarded });
                    } catch (err) {
                        Logger.trace('open', 'tab-create-failed', { workspaceId, index: i, url, cookieStoreId: t.cookieStoreId, error: err });
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
                                Logger.trace('open', 'tab-created-fallback', { workspaceId, index: i, tabId: newTab && newTab.id, url: newTab && newTab.url });
                            } catch (e2) {
                                console.error('Manager: Failed to restore tab (fallback)', e2);
                            }
                        } else {
                            console.error('Manager: Failed to restore tab', err);
                        }
                    }
                    createdTabIds.push(newTab ? newTab.id : null);
                }

                Logger.trace('open', 'tabs-restored', { workspaceId, createdTabIds, initialTabId });

                if (initialTabId) {
                    browser.tabs.remove(initialTabId).catch(() => {});
                }

                // Restore Groups
                if (ws.groups && browser.tabGroups) {
                    for (const group of ws.groups) {
                        try {
                            if (!group || typeof group !== 'object' || !Array.isArray(group.tabIndices)) {
                                continue;
                            }

                            const tabIdsToGroup = group.tabIndices
                                .map(idx => createdTabIds[idx])
                                .filter(id => id);

                            if (tabIdsToGroup.length > 0) {
                                const newGroupId = await browser.tabs.group({
                                    tabIds: tabIdsToGroup
                                });
                                await browser.tabGroups.update(newGroupId, {
                                    title: this.normalizeGroupTitle(group.title),
                                    color: this.normalizeGroupColor(group.color),
                                    collapsed: typeof group.collapsed === 'boolean' ? group.collapsed : false
                                });
                                Logger.trace('open', 'group-restored', { workspaceId, newGroupId, title: group.title, tabIds: tabIdsToGroup });
                            }
                        } catch (err) {
                            Logger.trace('open', 'group-restore-failed', { workspaceId, group, error: err });
                            console.error('Manager: Group restore error', err);
                        }
                    }
                }
            }
        } finally {
            Logger.trace('open', 'unlock-scheduled', { workspaceId, newWindowId, delayMs: 1000 });
            setTimeout(() => {
                Logger.trace('open', 'unlock-timer-fired', { workspaceId, newWindowId });
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
        Logger.trace('window-removed', 'handle', { windowId, workspaceId: workspaceId || null });
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

        Logger.trace('capture', 'start', { workspaceId, windowId: currentWin.id, focused: currentWin.focused, type: currentWin.type });
        Logger.debug(`Manager: Capturing window ${currentWin.id} for workspace ${workspaceId}`);
        // Link immediately in memory
        StateManager.linkWindow(currentWin.id, workspaceId);

        EventBus.emit(Events.WINDOW_LINKED, { windowId: currentWin.id, workspaceId });
        
        // Force a direct save logic here to ensure initial population
        
        try {
            const tabs = await browser.tabs.query({ windowId: currentWin.id });
            Logger.trace('capture', 'tabs-queried', {
                workspaceId,
                windowId: currentWin.id,
                tabs: tabs.map(t => ({ url: t.url, pinned: t.pinned, active: t.active, cookieStoreId: t.cookieStoreId }))
            });
            const tabData = this.normalizeSingleActiveTab(tabs.map(t => ({
                url: t.url,
                title: t.title,
                pinned: t.pinned,
                active: t.active,
                groupId: t.groupId,
                cookieStoreId: t.cookieStoreId
            })));

            await StorageService.mutateWorkspaces((workspaces) => {
                const wsIndex = workspaces.findIndex(w => w.id === workspaceId);
                if (wsIndex === -1) return workspaces;

                workspaces[wsIndex].tabs = tabData.map(t => ({
                    url: t.url,
                    title: t.title,
                    pinned: t.pinned,
                    active: t.active,
                    cookieStoreId: t.cookieStoreId
                }));
                workspaces[wsIndex].windowId = currentWin.id;
                Logger.trace('capture', 'stored', { workspaceId, windowId: currentWin.id, tabCount: tabData.length });
                Logger.debug(`Manager: Captured ${tabData.length} tabs.`);
                return workspaces;
            });
        } catch (e) {
            Logger.trace('capture', 'failed', { workspaceId, error: e });
            console.error('Manager: Failed to capture window state', e);
        }
    },

    /**
     * Updates workspace metadata (name, color).
     */
    async updateWorkspace(id, data) {
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === id);
        Logger.trace('update', 'workspace', { workspaceId: id, found: !!ws, data });
        if (ws) {
            if (data.name) ws.name = data.name;
            if (data.color) ws.color = data.color;
            await StorageService.saveWorkspace(ws);
            
            EventBus.emit(Events.WORKSPACE_UPDATED, { workspace: ws });
        }
    }
};
