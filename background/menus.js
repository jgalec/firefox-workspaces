/**
 * Context Menus Manager
 * Handles creating and updating the "Move to Workspace" menu.
 */

const MenusManager = {
    ROOT_ID: 'move-to-workspace-root',

    /**
     * Initializes the context menu items.
     * Idempotent-ish (recreates items).
     */
    async init() {
        // Create/Recreate root menu
        // We remove all first to ensure clean slate
        await browser.menus.removeAll();
        
        browser.menus.create({
            id: this.ROOT_ID,
            title: "Move tab to Workspace",
            contexts: ["tab"]
        });

        await this.updateSubmenus();
    },

    /**
     * Rebuilds the list of workspaces in the menu.
     */
    async updateSubmenus() {
        // To update, we can just clear and re-init, or selectively remove children.
        // For simplicity/robustness, we re-run init logic for items.
        // But we need to avoid recursion loop if init calls this.
        
        // Strategy: Get workspaces, add them as children.
        // First check if root exists, if not, init will handle it.
        // We'll assume root exists for updateSubmenus.
        
        const workspaces = await StorageService.getWorkspaces();
        
        // We need to clean up OLD submenu items.
        // Since we can't easily identify them without tracking IDs, 
        // resetting all menus is safest in this simple architecture.
        await browser.menus.removeAll();
        
        browser.menus.create({
            id: this.ROOT_ID,
            title: "Move tab to Workspace",
            contexts: ["tab"]
        });

        workspaces.forEach(ws => {
            browser.menus.create({
                id: ws.id,
                parentId: this.ROOT_ID,
                title: ws.name,
                contexts: ["tab"]
            });
        });
    },

    /**
     * Moves a tab to the target workspace window.
     */
    async handleMove(tabId, workspaceId) {
        console.log(`Menus: Moving tab ${tabId} to workspace ${workspaceId}`);
        
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