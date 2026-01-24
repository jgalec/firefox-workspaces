/**
 * Popup UI Module
 * Purely handles DOM manipulations and visual state.
 */

const PopupUI = {
    ui: {},

    init(uiRefs) {
        this.ui = uiRefs;
    },

    /**
     * Toggles between main list and create/edit form
     */
    toggleView(show, mode = 'create', data = null, selectedColor = '#0060df', colors = []) {
        if (show) {
            this.ui.mainView.classList.add('hidden');
            this.ui.createView.classList.remove('hidden');
            
            if (mode === 'edit' && data) {
                this.ui.createViewTitle.textContent = 'Edit Workspace';
                this.ui.confirmCreateBtn.textContent = 'Save Changes';
                this.ui.nameInput.value = data.name;
            } else {
                this.ui.createViewTitle.textContent = mode === 'save-window' ? 'Save Window as Workspace' : 'New Workspace';
                this.ui.confirmCreateBtn.textContent = 'Create';
                this.ui.nameInput.value = '';
            }
            
            this.renderColorPicker(data ? data.color : selectedColor, colors);
            this.ui.nameInput.focus();
        } else {
            this.ui.createView.classList.add('hidden');
            this.ui.mainView.classList.remove('hidden');
        }
    },

    /**
     * Renders the workspace list
     */
    renderList(workspaces, activeWindowId, openWindowIds, onSwitch, onDelete, onEdit) {
        this.ui.workspaceList.innerHTML = '';
        
        // Header Default
        this.ui.currentWorkspaceName.textContent = 'This Window';
        this.ui.currentWorkspaceName.classList.add('unmanaged');

        workspaces.forEach(workspace => {
            const clone = this.ui.template.content.cloneNode(true);
            const li = clone.querySelector('.workspace-item');
            const colorDiv = clone.querySelector('.workspace-color');
            const nameSpan = clone.querySelector('.workspace-name');
            const statusSpan = clone.querySelector('.status-indicator');

            nameSpan.textContent = workspace.name;
            colorDiv.style.backgroundColor = workspace.color || '#cccccc';

            if (workspace.windowId === activeWindowId) {
                li.classList.add('active');
                statusSpan.textContent = 'Active';
                this.ui.currentWorkspaceName.textContent = workspace.name;
                this.ui.currentWorkspaceName.classList.remove('unmanaged');
            } else if (workspace.windowId && openWindowIds.has(workspace.windowId)) {
                li.classList.add('open');
                statusSpan.textContent = 'Open';
            }

            li.addEventListener('click', () => onSwitch(workspace.id));
            
            clone.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onDelete(workspace.id, workspace.name);
            });

            clone.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onEdit(workspace);
            });
            
            this.ui.workspaceList.appendChild(clone);
        });
    },

    renderColorPicker(selectedColor, colors) {
        this.ui.colorPickerContainer.innerHTML = '';
        colors.forEach((color) => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            if (color === selectedColor) div.classList.add('selected');
            
            // Note: Listener will be attached here for simplicity as it's internal state
            div.addEventListener('click', () => {
                this.ui.colorPickerContainer.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                window.PopupLogic.selectedColor = color; // Cross-ref
            });
            this.ui.colorPickerContainer.appendChild(div);
        });
    },

    showDeleteModal(name) {
        this.ui.deleteNameDisplay.textContent = name;
        this.ui.deleteModal.classList.remove('hidden');
    },

    hideDeleteModal() {
        this.ui.deleteModal.classList.add('hidden');
    }
};
