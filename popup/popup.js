/**
 * Popup Logic for Firefox Workspaces
 * Interactions with the user and communication with the background script.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // UI References
    const mainView = document.getElementById('main-view');
    const createView = document.getElementById('create-view');
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

    // State
    let selectedColor = '#0060df'; 
    let workspaceToDeleteId = null;
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
            
            // Reset header text default
            currentWorkspaceName.textContent = 'This Window (Not Saved)';
            currentWorkspaceName.classList.add('unmanaged');

            workspaces.forEach(workspace => {
                const clone = template.content.cloneNode(true);
                const li = clone.querySelector('.workspace-item');
                const colorDiv = clone.querySelector('.workspace-color');
                const nameSpan = clone.querySelector('.workspace-name');
                const statusSpan = clone.querySelector('.status-indicator');

                nameSpan.textContent = workspace.name;
                colorDiv.style.backgroundColor = workspace.color || '#cccccc';

                // Status Logic
                if (workspace.windowId === currentWin.id) {
                    li.classList.add('active');
                    statusSpan.textContent = 'Active';
                    // Update Header
                    currentWorkspaceName.textContent = workspace.name;
                    currentWorkspaceName.classList.remove('unmanaged');
                } else if (workspace.windowId && openWindowIds.has(workspace.windowId)) {
                    li.classList.add('open');
                    statusSpan.textContent = 'Open';
                }

                li.addEventListener('click', () => switchWorkspace(workspace.id));
                
                // Delete Logic
                const deleteBtn = clone.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (deleteBtn.classList.contains('confirm-state')) {
                        deleteWorkspace(workspace.id);
                    } else {
                        // Use modal instead of inline confirm for better UX
                        promptDelete(workspace.id, workspace.name);
                    }
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

    async function createWorkspace() {
        const name = nameInput.value.trim();
        if (!name) return;

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
                payload: newWorkspace 
            });
            toggleView(false);
            renderWorkspaces();
        } catch (error) {
            console.error('Popup: Error creating workspace', error);
        }
    }

    /**
     * UI Helpers
     */
    function toggleView(showCreate) {
        if (showCreate) {
            mainView.classList.add('hidden');
            createView.classList.remove('hidden');
            nameInput.value = '';
            nameInput.focus();
            renderColorPicker();
        } else {
            createView.classList.add('hidden');
            mainView.classList.remove('hidden');
        }
    }

    function promptDelete(id, name) {
        workspaceToDeleteId = id;
        deleteNameDisplay.textContent = name;
        deleteModal.classList.remove('hidden');
    }

    function renderColorPicker() {
        colorPickerContainer.innerHTML = '';
        selectedColor = availableColors[0];
        availableColors.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            if (index === 0) div.classList.add('selected');
            div.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedColor = color;
            });
            colorPickerContainer.appendChild(div);
        });
    }

    // Event Listeners
    showCreateUiBtn.addEventListener('click', () => toggleView(true));
    cancelCreateBtn.addEventListener('click', () => toggleView(false));
    confirmCreateBtn.addEventListener('click', createWorkspace);
    
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
        if (e.key === 'Enter') createWorkspace();
        if (e.key === 'Escape') toggleView(false);
    });

    renderWorkspaces();
});
