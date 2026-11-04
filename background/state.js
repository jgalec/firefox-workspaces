/**
 * State Manager
 * Handles in-memory state tracking for windows and restoration locks.
 */

const StateManager = {
    // Maps WindowID (number) -> WorkspaceID (string)
    windowToWorkspaceMap: {},

    // Set of WindowIDs currently being restored (to block auto-save)
    restoringWindows: new Set(),

    /**
     * Links a window to a workspace in memory.
     */
    linkWindow(windowId, workspaceId) {
        Logger.trace('state', 'link', {
            windowId,
            workspaceId,
            previousWorkspaceId: this.windowToWorkspaceMap[windowId] || null
        });
        this.windowToWorkspaceMap[windowId] = workspaceId;
    },

    /**
     * Unlinks a window (e.g., on close).
     */
    unlinkWindow(windowId) {
        Logger.trace('state', 'unlink', { windowId, workspaceId: this.windowToWorkspaceMap[windowId] || null });
        delete this.windowToWorkspaceMap[windowId];
    },

    /**
     * Gets the workspace ID for a given window.
     */
    getWorkspaceId(windowId) {
        return this.windowToWorkspaceMap[windowId];
    },

    /**
     * Locks a window to prevent auto-saving during restoration.
     */
    lockWindow(windowId) {
        this.restoringWindows.add(windowId);
        Logger.trace('state', 'lock', { windowId, lockedWindows: this.restoringWindows });
        Logger.debug(`State: Locked window ${windowId}`);
    },

    /**
     * Unlocks a window.
     */
    unlockWindow(windowId) {
        this.restoringWindows.delete(windowId);
        Logger.trace('state', 'unlock', { windowId, lockedWindows: this.restoringWindows });
        Logger.debug(`State: Unlocked window ${windowId}`);
    },

    /**
     * Checks if a window is locked.
     */
    isLocked(windowId) {
        return this.restoringWindows.has(windowId);
    },

    /**
     * Resets the map (useful for hydration).
     */
    resetMap() {
        Logger.trace('state', 'resetMap', { previous: this.windowToWorkspaceMap });
        this.windowToWorkspaceMap = {};
    }
};
