/**
 * Popup Logic Module
 * Handles data, communication, and business rules.
 */

const PopupLogic = {
    selectedColor: '#0060df',
    editingWorkspaceId: null,
    workspaceToDeleteId: null,
    saveFromCurrentWindow: false,
    availableColors: [
        '#ff4f5e', // Red 50
        '#ff7139', // Orange 50
        '#ffa436', // Yellow 50
        '#00d230', // Mozilla Green
        '#87e3cd', // Mozilla Aqua
        '#0060df', // Primary Blue
        '#9059ff', // Firefox Purple
        '#ff97e2'  // Mozilla Pink
    ],

    generateWorkspaceId() {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
            return `ws-${globalThis.crypto.randomUUID()}`;
        }

        return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    },

    async refreshData() {
        const currentWin = await browser.windows.getCurrent();
        const allWindows = await browser.windows.getAll();
        const openWindowIds = new Set(allWindows.map(w => w.id));
        const data = await browser.storage.local.get('workspaces');
        const workspaces = data.workspaces || [];

        PopupUI.renderList(
            workspaces, 
            currentWin.id, 
            openWindowIds,
            (id) => this.switchWorkspace(id),
            (id, name) => this.promptDelete(id, name),
            (ws) => this.startEdit(ws),
            (from, to, after) => this.handleReorder(from, to, after)
        );
    },

    async switchWorkspace(id) {
        await browser.runtime.sendMessage({ type: 'SWITCH_WORKSPACE', workspaceId: id });
        this.refreshData();
    },

    async handleSave(name) {
        if (this.editingWorkspaceId) {
            await browser.runtime.sendMessage({ 
                type: 'UPDATE_WORKSPACE', 
                workspaceId: this.editingWorkspaceId,
                payload: { name, color: this.selectedColor } 
            });
        } else {
            const newWorkspace = {
                id: this.generateWorkspaceId(),
                name: name,
                color: this.selectedColor,
                tabs: [],
                groups: [],
                windowId: null,
                lastActive: Date.now()
            };
            await browser.runtime.sendMessage({ 
                type: 'CREATE_WORKSPACE', 
                payload: newWorkspace,
                fromCurrentWindow: this.saveFromCurrentWindow
            });
        }
        this.editingWorkspaceId = null;
        this.saveFromCurrentWindow = false;
        PopupUI.toggleView(false);
        this.refreshData();
    },

    async confirmDelete() {
        if (this.workspaceToDeleteId) {
            await browser.runtime.sendMessage({ type: 'DELETE_WORKSPACE', workspaceId: this.workspaceToDeleteId });
            this.workspaceToDeleteId = null;
            PopupUI.hideDeleteModal();
            this.refreshData();
        }
    },

    promptDelete(id, name) {
        this.workspaceToDeleteId = id;
        PopupUI.showDeleteModal(name);
    },

    startEdit(ws) {
        this.editingWorkspaceId = ws.id;
        this.selectedColor = ws.color;
        PopupUI.toggleView(true, 'edit', ws, this.selectedColor, this.availableColors);
    },

    startCreate(mode = 'create') {
        this.editingWorkspaceId = null;
        this.saveFromCurrentWindow = (mode === 'save-window');
        this.selectedColor = this.availableColors[0];
        PopupUI.toggleView(true, mode, null, this.selectedColor, this.availableColors);
    },

    async handleReorder(fromIndex, toIndex, dropAfter) {
        try {
            const data = await browser.storage.local.get('workspaces');
            const workspaces = data.workspaces || [];
            
            const [movedItem] = workspaces.splice(fromIndex, 1);
            
            let finalIndex = toIndex;
            if (fromIndex < toIndex) finalIndex--; 
            if (dropAfter) finalIndex++;
            
            workspaces.splice(finalIndex, 0, movedItem);
            
            await browser.storage.local.set({ workspaces });
            // Notify background to update context menu order
            browser.runtime.sendMessage({ type: 'UPDATE_WORKSPACE', workspaceId: 'reorder', payload: {} });
            this.refreshData();
        } catch (error) { console.error('PopupLogic: Error reordering', error); }
    }
};
