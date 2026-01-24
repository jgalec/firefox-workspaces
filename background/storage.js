/**
 * Storage Service for Firefox Workspaces
 * Handles all interactions with browser.storage.local
 */

const StorageService = {
    /**
     * Keys used in local storage
     */
    KEYS: {
        WORKSPACES: 'workspaces',
        ACTIVE_WORKSPACE_ID: 'activeWorkspaceId'
    },

    /**
     * Retrieves all workspaces from storage.
     * @returns {Promise<Array>} List of workspaces
     */
    async getWorkspaces() {
        try {
            const result = await browser.storage.local.get(this.KEYS.WORKSPACES);
            return result[this.KEYS.WORKSPACES] || [];
        } catch (error) {
            console.error('StorageService: Error fetching workspaces', error);
            return [];
        }
    },

    /**
     * Saves a workspace (create or update).
     * @param {Object} workspace - The workspace object to save
     * @returns {Promise<void>}
     */
    async saveWorkspace(workspace) {
        try {
            const workspaces = await this.getWorkspaces();
            const index = workspaces.findIndex(w => w.id === workspace.id);

            if (index > -1) {
                // Update existing
                workspaces[index] = workspace;
            } else {
                // Create new
                workspaces.push(workspace);
            }

            await browser.storage.local.set({ [this.KEYS.WORKSPACES]: workspaces });
            console.log(`StorageService: Workspace '${workspace.name}' saved.`);
        } catch (error) {
            console.error('StorageService: Error saving workspace', error);
        }
    },

    /**
     * Deletes a workspace by ID.
     * @param {string} workspaceId 
     * @returns {Promise<void>}
     */
    async deleteWorkspace(workspaceId) {
        try {
            const workspaces = await this.getWorkspaces();
            const filtered = workspaces.filter(w => w.id !== workspaceId);
            await browser.storage.local.set({ [this.KEYS.WORKSPACES]: filtered });
            console.log(`StorageService: Workspace ${workspaceId} deleted.`);
        } catch (error) {
            console.error('StorageService: Error deleting workspace', error);
        }
    },

    /**
     * Gets the ID of the currently active workspace.
     * @returns {Promise<string|null>} ID or null if none active
     */
    async getActiveWorkspaceId() {
        try {
            const result = await browser.storage.local.get(this.KEYS.ACTIVE_WORKSPACE_ID);
            return result[this.KEYS.ACTIVE_WORKSPACE_ID] || null;
        } catch (error) {
            console.error('StorageService: Error fetching active ID', error);
            return null;
        }
    },

    /**
     * Sets the active workspace ID.
     * @param {string} workspaceId 
     * @returns {Promise<void>}
     */
    async setActiveWorkspaceId(workspaceId) {
        try {
            await browser.storage.local.set({ [this.KEYS.ACTIVE_WORKSPACE_ID]: workspaceId });
            console.log(`StorageService: Active workspace set to ${workspaceId}`);
        } catch (error) {
            console.error('StorageService: Error setting active ID', error);
        }
    },

    /**
     * Clears all data (useful for debugging/reset).
     */
    async clearAll() {
        await browser.storage.local.clear();
        console.log('StorageService: All data cleared.');
    }
};
