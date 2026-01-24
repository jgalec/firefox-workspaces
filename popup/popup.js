/**
 * Popup Logic for Firefox Workspaces
 * Interactions with the user and communication with the background script.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup: DOM Loaded. Initializing...');
    
    // UI References
    const mainView = document.getElementById('main-view');
    const createView = document.getElementById('create-view');
    const workspaceList = document.getElementById('workspace-list');
    const currentWorkspaceName = document.getElementById('current-workspace-name');
    const template = document.getElementById('workspace-item-template');
    
    // Create Form References
    const nameInput = document.getElementById('new-ws-name');
    const colorPickerContainer = document.getElementById('color-picker');
    
    // Buttons
    const showCreateUiBtn = document.getElementById('show-create-ui-btn');
    const cancelCreateBtn = document.getElementById('cancel-create-btn');
    const confirmCreateBtn = document.getElementById('confirm-create-btn');

    // State
    let selectedColor = '#0060df'; // Default
    const availableColors = [
        '#0060df', // Blue
        '#008740', // Green
        '#d70022', // Red
        '#f5a623', // Orange
        '#9059ff', // Purple
        '#0590b0', // Cyan
        '#ff4aa2', // Pink
        '#ffb300'  // Amber
    ];

    /**
     * Loads workspaces from storage and renders them.
     */
    async function renderWorkspaces() {
        try {
            const data = await browser.storage.local.get(['workspaces', 'activeWorkspaceId']);
            const workspaces = data.workspaces || [];
            const activeId = data.activeWorkspaceId;

            workspaceList.innerHTML = '';

            workspaces.forEach(workspace => {
                const clone = template.content.cloneNode(true);
                const li = clone.querySelector('.workspace-item');
                const colorDiv = clone.querySelector('.workspace-color');
                const nameSpan = clone.querySelector('.workspace-name');

                nameSpan.textContent = workspace.name;
                colorDiv.style.backgroundColor = workspace.color || '#cccccc';

                if (workspace.id === activeId) {
                    li.classList.add('active');
                    currentWorkspaceName.textContent = workspace.name;
                }

                li.addEventListener('click', () => switchWorkspace(workspace.id));
                workspaceList.appendChild(clone);
            });

            if (!activeId && workspaces.length > 0) {
                currentWorkspaceName.textContent = 'None';
            }
        } catch (error) {
            console.error('Popup: Error rendering workspaces', error);
        }
    }

    /**
     * Switch Workspace Request
     */
    async function switchWorkspace(id) {
        try {
            // Optimistic UI update
            const items = document.querySelectorAll('.workspace-item');
            items.forEach(item => item.classList.remove('active'));
            
            await browser.runtime.sendMessage({ 
                type: 'SWITCH_WORKSPACE', 
                workspaceId: id 
            });
            
            renderWorkspaces();
        } catch (error) {
            console.error('Popup: Error switching workspace', error);
        }
    }

    /**
     * View Toggling
     */
    function toggleView(showCreate) {
        if (showCreate) {
            mainView.classList.add('hidden');
            createView.classList.remove('hidden');
            nameInput.value = ''; // Reset input
            nameInput.focus();
            renderColorPicker(); // Reset selection
        } else {
            createView.classList.add('hidden');
            mainView.classList.remove('hidden');
        }
    }

    /**
     * Render Color Picker Options
     */
    function renderColorPicker() {
        colorPickerContainer.innerHTML = '';
        selectedColor = availableColors[0]; // Reset to first

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

    /**
     * Create Workspace Logic
     */
    async function createWorkspace() {
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.style.borderColor = '#d70022'; // Error state
            return;
        }

        const newWorkspace = {
            id: 'ws-' + Date.now(),
            name: name,
            color: selectedColor,
            tabIds: [],
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

    // Event Listeners
    showCreateUiBtn.addEventListener('click', () => toggleView(true));
    cancelCreateBtn.addEventListener('click', () => toggleView(false));
    confirmCreateBtn.addEventListener('click', createWorkspace);
    
    // Handle Enter key in input
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createWorkspace();
        if (e.key === 'Escape') toggleView(false);
    });

    // Initial render
    renderWorkspaces();
});