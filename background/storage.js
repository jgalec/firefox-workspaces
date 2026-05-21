/**
 * Storage Service for Workspaces
 * Handles all interactions with browser.storage.local
 */

const StorageService = {
    writeQueue: Promise.resolve(),

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

    enqueueWrite(operation) {
        this.writeQueue = this.writeQueue
            .then(() => operation())
            .catch(error => {
                console.error('StorageService: Write queue operation failed', error);
            });

        return this.writeQueue;
    },

    async mutateWorkspaces(mutator) {
        return this.enqueueWrite(async () => {
            const result = await browser.storage.local.get(this.KEYS.WORKSPACES);
            const workspaces = result[this.KEYS.WORKSPACES] || [];
            const nextWorkspaces = await mutator(workspaces);
            await browser.storage.local.set({ [this.KEYS.WORKSPACES]: nextWorkspaces });
            return nextWorkspaces;
        });
    },

    /**
     * Saves a workspace (create or update).
     * @param {Object} workspace - The workspace object to save
     * @returns {Promise<void>}
     */
    async saveWorkspace(workspace) {
        try {
            await this.mutateWorkspaces((workspaces) => {
                const index = workspaces.findIndex(w => w.id === workspace.id);

                if (index > -1) {
                    workspaces[index] = workspace;
                } else {
                    workspaces.push(workspace);
                }

                return workspaces;
            });
            Logger.debug(`StorageService: Workspace '${workspace.name}' saved.`);
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
            await this.mutateWorkspaces((workspaces) => {
                return workspaces.filter(w => w.id !== workspaceId);
            });
            Logger.debug(`StorageService: Workspace ${workspaceId} deleted.`);
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
            Logger.debug(`StorageService: Active workspace set to ${workspaceId}`);
        } catch (error) {
            console.error('StorageService: Error setting active ID', error);
        }
    },

    /**
     * Clears all data (useful for debugging/reset).
     */
    async clearAll() {
        await browser.storage.local.clear();
        Logger.debug('StorageService: All data cleared.');
    }
};
