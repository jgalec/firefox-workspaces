/**
 * Background Controller - Main Logic
 * Manages workspace state and coordinates tab handling.
 */

console.log('Background Controller: Service started.');

/**
 * Capture the current state of tabs and assign them to the active workspace.
 * This should be called BEFORE switching away from a workspace.
 */
async function saveCurrentWorkspaceState() {
    const activeId = await StorageService.getActiveWorkspaceId();
    if (!activeId) return;

    // Get all tabs in the current window that are NOT hidden
    // We assume visible tabs belong to the current workspace
    const tabs = await browser.tabs.query({ currentWindow: true, hidden: false });
    const tabIds = tabs.map(t => t.id);

    // Fetch current workspace data to update it
    const workspaces = await StorageService.getWorkspaces();
    const currentWs = workspaces.find(w => w.id === activeId);

    if (currentWs) {
        currentWs.tabIds = tabIds;
        await StorageService.saveWorkspace(currentWs);
        console.log(`Background: Saved ${tabIds.length} tabs to workspace '${currentWs.name}'`);
    }
}

/**
 * Message Handler
 * Entry point for UI interactions (Popup)
 */
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
        switch (message.type) {
            case 'SWITCH_WORKSPACE':
                console.log(`Background: Received switch request to ${message.workspaceId}`);
                
                // 1. Save state of the OLD workspace
                await saveCurrentWorkspaceState();

                // 2. Set the NEW workspace as active
                await StorageService.setActiveWorkspaceId(message.workspaceId);

                // 3. (Future Phase 4) Perform the visual Tab Hiding/Showing here
                console.log('Background: Ready to trigger tab visibility updates (Phase 4).');
                
                // Respond success
                return { success: true };

            case 'CREATE_WORKSPACE':
                console.log('Background: Creating new workspace', message.payload);
                await StorageService.saveWorkspace(message.payload);
                return { success: true };

            default:
                // Unknown message
                return;
        }
    } catch (error) {
        console.error('Background: Error handling message', error);
        return { success: false, error: error.message };
    }
});

/**
 * Initialization
 * Ensures a default workspace exists on first run.
 */
async function initialize() {
    const workspaces = await StorageService.getWorkspaces();
    if (workspaces.length === 0) {
        console.log('Background: First run detected. Creating Default Workspace.');
        const defaultWs = {
            id: 'ws-default',
            name: 'Main',
            color: '#0060df',
            tabIds: [], // Will be populated by saveCurrentWorkspaceState later
            lastActive: Date.now()
        };
        await StorageService.saveWorkspace(defaultWs);
        await StorageService.setActiveWorkspaceId(defaultWs.id);
    } else {
        const activeId = await StorageService.getActiveWorkspaceId();
        console.log(`Background: Initialized. Active Workspace: ${activeId}`);
    }
}

browser.runtime.onInstalled.addListener(initialize);
browser.runtime.onStartup.addListener(initialize);
