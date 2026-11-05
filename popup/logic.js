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

        Logger.trace('popup', 'refresh', {
            currentWindowId: currentWin.id,
            openWindowIds,
            workspaces: workspaces.map(w => ({ id: w.id, name: w.name, windowId: w.windowId, tabCount: (w.tabs || []).length }))
        });

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
        Logger.trace('popup', 'action', { action: 'switch', workspaceId: id });
        const response = await browser.runtime.sendMessage({ type: 'SWITCH_WORKSPACE', workspaceId: id });
        Logger.trace('popup', 'response', { action: 'switch', workspaceId: id, response });
        this.refreshData();
    },

    async handleSave(name) {
        Logger.trace('popup', 'action', {
            action: 'save',
            mode: this.editingWorkspaceId ? 'update' : 'create',
            editingWorkspaceId: this.editingWorkspaceId,
            name,
            color: this.selectedColor,
            fromCurrentWindow: this.saveFromCurrentWindow
        });
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
        Logger.trace('popup', 'response', { action: 'save', message: 'sent' });
        this.editingWorkspaceId = null;
        this.saveFromCurrentWindow = false;
        PopupUI.toggleView(false);
        this.refreshData();
    },

    async confirmDelete() {
        Logger.trace('popup', 'action', { action: 'confirm-delete', workspaceId: this.workspaceToDeleteId });
        if (this.workspaceToDeleteId) {
            await browser.runtime.sendMessage({ type: 'DELETE_WORKSPACE', workspaceId: this.workspaceToDeleteId });
            this.workspaceToDeleteId = null;
            PopupUI.hideDeleteModal();
            this.refreshData();
        }
    },

    promptDelete(id, name) {
        Logger.trace('popup', 'action', { action: 'prompt-delete', workspaceId: id, name });
        this.workspaceToDeleteId = id;
        PopupUI.showDeleteModal(name);
    },

    startEdit(ws) {
        Logger.trace('popup', 'action', { action: 'start-edit', workspaceId: ws.id, name: ws.name });
        this.editingWorkspaceId = ws.id;
        this.selectedColor = ws.color;
        PopupUI.toggleView(true, 'edit', ws, this.selectedColor, this.availableColors);
    },

    startCreate(mode = 'create') {
        Logger.trace('popup', 'action', { action: 'start-create', mode });
        this.editingWorkspaceId = null;
        this.saveFromCurrentWindow = (mode === 'save-window');
        this.selectedColor = this.availableColors[0];
        PopupUI.toggleView(true, mode, null, this.selectedColor, this.availableColors);
    },

    async handleReorder(fromIndex, toIndex, dropAfter) {
        Logger.trace('popup', 'action', { action: 'reorder', fromIndex, toIndex, dropAfter });
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
        } catch (error) {
            Logger.trace('popup', 'reorder-failed', { error });
            console.error('PopupLogic: Error reordering', error);
        }
    }
};
