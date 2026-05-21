/**
 * UI Indicator Manager
 * Handles visual cues by dynamically changing the extension icon color.
 */

const IndicatorManager = {
    initialized: false,

    // Template for the 'square-stack' icon
    // We use a placeholder for the stroke color
    ICON_TEMPLATE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="2 2 20 20" stroke-width="2" stroke="{COLOR}">
  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
</svg>`,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Subscribe to events
        EventBus.on(Events.WORKSPACE_OPENED, ({ windowId, workspace }) => {
            this.updateWindowIcon(windowId, workspace);
        });

        EventBus.on(Events.WINDOW_LINKED, async ({ windowId, workspaceId }) => {
            const workspaces = await StorageService.getWorkspaces();
            const ws = workspaces.find(w => w.id === workspaceId);
            if (ws) this.updateWindowIcon(windowId, ws);
        });

        EventBus.on(Events.WORKSPACE_UPDATED, async ({ workspace }) => {
            if (workspace.windowId) {
                this.updateWindowIcon(workspace.windowId, workspace);
            }
        });
    },

    /**
     * Updates the extension icon for a specific window.
     * @param {number} windowId - The browser window ID
     * @param {Object} workspace - The workspace object (can be null to reset)
     */
    async updateWindowIcon(windowId, workspace) {
        // Clear any old badge text just in case
        await browser.action.setBadgeText({ text: "", windowId });

        if (!workspace) {
            // Reset to default icon (currentColor/black effectively)
            // Or we can explicitly set it to a neutral color
            await browser.action.setIcon({ path: "icons/default-icon.svg", windowId });
            await browser.action.setTitle({ title: "Open Workspaces", windowId });
            return;
        }

        let color = workspace.color || "currentColor";

        // Security: Validate color to prevent XML injection
        // Allow "currentColor" or Hex codes (3 or 6 digits)
        if (color !== "currentColor" && !/^#([A-Fa-f0-9]{3}){1,2}$/.test(color)) {
            console.warn(`Indicator: Invalid color '${color}', falling back.`);
            color = "currentColor";
        }
        
        // Generate SVG with the workspace color
        // encodeURIComponent is safer than atob/btoa for SVG content
        const svgString = this.ICON_TEMPLATE.replace('{COLOR}', color);
        const iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

        try {
            await browser.action.setIcon({ path: iconUrl, windowId });
            await browser.action.setTitle({ 
                title: `Workspace: ${workspace.name}`, 
                windowId 
            });
        } catch (error) {
            console.error('Indicator: Failed to set icon', error);
        }
    }
};
