/**
 * Popup Logic for Firefox Workspaces
 * Interactions with the user and communication with the background script.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // UI References
    const mainView = document.getElementById('main-view');
    const createView = document.getElementById('create-view');
    const createViewTitle = document.getElementById('create-view-title'); // Header title
    const workspaceList = document.getElementById('workspace-list');
    const currentWorkspaceName = document.getElementById('current-workspace-name');
    const template = document.getElementById('workspace-item-template');
    
    // Create Form References
    const nameInput = document.getElementById('new-ws-name');
    const colorPickerContainer = document.getElementById('color-picker');
    
    // Delete Modal References
    const deleteModal = document.getElementById('delete-modal');
    const deleteNameDisplay = document.getElementById('delete-ws-name-display');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    
    // Buttons
    const showCreateUiBtn = document.getElementById('show-create-ui-btn');
    const cancelCreateBtn = document.getElementById('cancel-create-btn');
    const confirmCreateBtn = document.getElementById('confirm-create-btn');

    // Options Menu References
    const optionsMenuBtn = document.getElementById('options-menu-btn');
    const optionsDropdown = document.getElementById('options-dropdown');
    const saveWindowBtn = document.getElementById('save-window-btn');
    const exportWorkspacesBtn = document.getElementById('export-workspaces-btn');

    // State
    let selectedColor = '#0060df'; 
    let workspaceToDeleteId = null;
    let editingWorkspaceId = null; 
    let saveFromCurrentWindow = false; // New flag for feature 1
    const availableColors = ['#0060df', '#008740', '#d70022', '#f5a623', '#9059ff', '#0590b0', '#ff4aa2', '#ffb300'];

    /**
     * Loads workspaces from storage and renders them.
     */
    async function renderWorkspaces() {
        try {
            const currentWin = await browser.windows.getCurrent();
            const allWindows = await browser.windows.getAll();
            const openWindowIds = new Set(allWindows.map(w => w.id));

            const data = await browser.storage.local.get('workspaces');
            const workspaces = data.workspaces || [];

            workspaceList.innerHTML = '';
            
            currentWorkspaceName.textContent = 'This Window';
            currentWorkspaceName.classList.add('unmanaged');

            workspaces.forEach(workspace => {
                const clone = template.content.cloneNode(true);
                const li = clone.querySelector('.workspace-item');
                const colorDiv = clone.querySelector('.workspace-color');
                const nameSpan = clone.querySelector('.workspace-name');
                const statusSpan = clone.querySelector('.status-indicator');

                nameSpan.textContent = workspace.name;
                colorDiv.style.backgroundColor = workspace.color || '#cccccc';

                if (workspace.windowId === currentWin.id) {
                    li.classList.add('active');
                    statusSpan.textContent = 'Active';
                    currentWorkspaceName.textContent = workspace.name;
                    currentWorkspaceName.classList.remove('unmanaged');
                } else if (workspace.windowId && openWindowIds.has(workspace.windowId)) {
                    li.classList.add('open');
                    statusSpan.textContent = 'Open';
                }

                li.addEventListener('click', () => switchWorkspace(workspace.id));
                
                // Actions
                const deleteBtn = clone.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (deleteBtn.classList.contains('confirm-state')) {
                        deleteWorkspace(workspace.id);
                    } else {
                        promptDelete(workspace.id, workspace.name);
                    }
                });

                const editBtn = clone.querySelector('.edit-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleView(true, 'edit', workspace);
                });
                
                workspaceList.appendChild(clone);
            });

        } catch (error) {
            console.error('Popup: Error rendering workspaces', error);
        }
    }

    /**
     * Actions
     */
    async function switchWorkspace(id) {
        try {
            await browser.runtime.sendMessage({ 
                type: 'SWITCH_WORKSPACE', 
                workspaceId: id 
            });
            renderWorkspaces();
        } catch (error) {
            console.error('Popup: Error switching workspace', error);
        }
    }

    async function deleteWorkspace(id) {
        try {
            await browser.runtime.sendMessage({ 
                type: 'DELETE_WORKSPACE', 
                workspaceId: id 
            });
            renderWorkspaces();
        } catch (error) {
            console.error('Popup: Error deleting workspace', error);
        }
    }

    async function handleSave() {
        const name = nameInput.value.trim();
        if (!name) return;

        if (editingWorkspaceId) {
            // UPDATE Mode
            try {
                await browser.runtime.sendMessage({ 
                    type: 'UPDATE_WORKSPACE', 
                    workspaceId: editingWorkspaceId,
                    payload: { name, color: selectedColor } 
                });
                toggleView(false);
                renderWorkspaces();
            } catch (error) {
                console.error('Popup: Error updating workspace', error);
            }
        } else {
            // CREATE Mode
            const newWorkspace = {
                id: 'ws-' + Date.now(),
                name: name,
                color: selectedColor,
                tabs: [],
                groups: [],
                windowId: null,
                lastActive: Date.now()
            };

            try {
                await browser.runtime.sendMessage({ 
                    type: 'CREATE_WORKSPACE', 
                    payload: newWorkspace,
                    fromCurrentWindow: saveFromCurrentWindow // New flag
                });
                toggleView(false);
                renderWorkspaces();
            } catch (error) {
                console.error('Popup: Error creating workspace', error);
            }
        }
    }

    /**
     * UI Helpers
     */
    function toggleView(show, mode = 'create', data = null) {
        if (show) {
            mainView.classList.add('hidden');
            createView.classList.remove('hidden');
            
            if (mode === 'edit' && data) {
                createViewTitle.textContent = 'Edit Workspace';
                confirmCreateBtn.textContent = 'Save Changes';
                editingWorkspaceId = data.id;
                nameInput.value = data.name;
                selectedColor = data.color || '#0060df';
            } else {
                // 'create' mode
                if (!saveFromCurrentWindow) {
                    createViewTitle.textContent = 'New Workspace';
                }
                confirmCreateBtn.textContent = 'Create';
                editingWorkspaceId = null;
                nameInput.value = '';
                selectedColor = availableColors[0];
            }
            
            renderColorPicker(); 
            nameInput.focus();
        } else {
            createView.classList.add('hidden');
            mainView.classList.remove('hidden');
            editingWorkspaceId = null;
            saveFromCurrentWindow = false; // Reset flag
        }
    }

    function promptDelete(id, name) {
        workspaceToDeleteId = id;
        deleteNameDisplay.textContent = name;
        deleteModal.classList.remove('hidden');
    }

    function renderColorPicker() {
        colorPickerContainer.innerHTML = '';
        availableColors.forEach((color) => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            if (color === selectedColor) div.classList.add('selected');
            div.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedColor = color;
            });
            colorPickerContainer.appendChild(div);
        });
    }

    // Event Listeners
    showCreateUiBtn.addEventListener('click', () => toggleView(true, 'create'));
    cancelCreateBtn.addEventListener('click', () => toggleView(false));
    confirmCreateBtn.addEventListener('click', handleSave);
    
    // Modal Listeners
    confirmDeleteBtn.addEventListener('click', async () => {
        if (workspaceToDeleteId) {
            await deleteWorkspace(workspaceToDeleteId);
            workspaceToDeleteId = null;
            deleteModal.classList.add('hidden');
        }
    });
    cancelDeleteBtn.addEventListener('click', () => {
        workspaceToDeleteId = null;
        deleteModal.classList.add('hidden');
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') toggleView(false);
    });

    // Options Menu Handlers
    optionsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        optionsDropdown.classList.add('hidden');
    });

    saveWindowBtn.addEventListener('click', () => {
        optionsDropdown.classList.add('hidden');
        saveFromCurrentWindow = true;
        toggleView(true, 'create');
        createViewTitle.textContent = 'Save Window as Workspace';
    });

    exportWorkspacesBtn.addEventListener('click', async () => {
        optionsDropdown.classList.add('hidden');
        await exportWorkspaces();
    });

    renderWorkspaces();
});