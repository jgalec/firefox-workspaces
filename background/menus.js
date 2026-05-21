/**
 * Context Menus Manager
 * Handles creating and updating the "Move to Workspace" menu.
 */

const MenusManager = {
    ROOT_ID: 'move-to-workspace-root',
    workspaceMenuIds: new Set(),
    rootCreated: false,

    async ensureRootMenu() {
        if (this.rootCreated) return;

        try {
            browser.menus.create({
                id: this.ROOT_ID,
                title: 'Move tab to Workspace',
                contexts: ['tab']
            });
            this.rootCreated = true;
        } catch (error) {
            if (!String(error).includes('ID already exists')) {
                throw error;
            }
            this.rootCreated = true;
        }
    },

    /**
     * Initializes the context menu items.
     * Idempotent-ish (recreates items).
     */
    async init() {
        // Create/Recreate root menu
        // We remove all first to ensure clean slate
        await browser.menus.removeAll();

        this.workspaceMenuIds.clear();
        this.rootCreated = false;
        await this.ensureRootMenu();

        await this.updateSubmenus();
    },

    /**
     * Rebuilds the list of workspaces in the menu.
     */
    async updateSubmenus() {
        await this.ensureRootMenu();

        const workspaces = await StorageService.getWorkspaces();
        const nextWorkspaceIds = new Set(workspaces.map(ws => ws.id));

        for (const existingId of this.workspaceMenuIds) {
            if (!nextWorkspaceIds.has(existingId)) {
                try {
                    await browser.menus.remove(existingId);
                } catch (error) {
                    console.error(`Menus: Failed to remove menu item ${existingId}`, error);
                }
            }
        }

        this.workspaceMenuIds = new Set([...this.workspaceMenuIds].filter(id => nextWorkspaceIds.has(id)));

        for (const ws of workspaces) {
            if (!this.workspaceMenuIds.has(ws.id)) {
                try {
                    browser.menus.create({
                        id: ws.id,
                        parentId: this.ROOT_ID,
                        title: ws.name,
                        contexts: ['tab']
                    });
                    this.workspaceMenuIds.add(ws.id);
                } catch (error) {
                    console.error(`Menus: Failed to create menu item ${ws.id}`, error);
                }
            } else {
                try {
                    await browser.menus.update(ws.id, { title: ws.name });
                } catch (error) {
                    console.error(`Menus: Failed to update menu item ${ws.id}`, error);
                }
            }
        }
    },

    /**
     * Moves a tab to the target workspace window.
     */
    async handleMove(tabId, workspaceId) {
        Logger.debug(`Menus: Moving tab ${tabId} to workspace ${workspaceId}`);
        
        // 1. Ensure target window is open
        await WorkspaceManager.openWorkspace(workspaceId);
        
        // Give a tiny buffer for window registration if it was just created
        await new Promise(r => setTimeout(r, 300));

        // 2. Get the new windowId
        const workspaces = await StorageService.getWorkspaces();
        const ws = workspaces.find(w => w.id === workspaceId);
        
        if (ws && ws.windowId) {
            // 3. Move tab
            try {
                await browser.tabs.move(tabId, { windowId: ws.windowId, index: -1 });
                await browser.tabs.update(tabId, { active: true });
            } catch (error) {
                console.error('Menus: Error moving tab', error);
            }
        }
    }
};

// --- Register Listener ONCE at top level ---
browser.menus.onClicked.addListener((info, tab) => {
    if (info.parentMenuItemId === MenusManager.ROOT_ID) {
        MenusManager.handleMove(tab.id, info.menuItemId);
    }
});
