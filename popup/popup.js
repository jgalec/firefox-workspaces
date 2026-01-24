/**
 * Popup Entry Point
 */

document.addEventListener('DOMContentLoaded', () => {
    const uiRefs = {
        mainView: document.getElementById('main-view'),
        createView: document.getElementById('create-view'),
        createViewTitle: document.getElementById('create-view-title'),
        workspaceList: document.getElementById('workspace-list'),
        currentWorkspaceName: document.getElementById('current-workspace-name'),
        template: document.getElementById('workspace-item-template'),
        nameInput: document.getElementById('new-ws-name'),
        colorPickerContainer: document.getElementById('color-picker'),
        deleteModal: document.getElementById('delete-modal'),
        deleteNameDisplay: document.getElementById('delete-ws-name-display'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
        showCreateUiBtn: document.getElementById('show-create-ui-btn'),
        cancelCreateBtn: document.getElementById('cancel-create-btn'),
        confirmCreateBtn: document.getElementById('confirm-create-btn'),
        optionsMenuBtn: document.getElementById('options-menu-btn'),
        optionsDropdown: document.getElementById('options-dropdown'),
        saveWindowBtn: document.getElementById('save-window-btn')
    };

    // Global availability for cross-module access if needed
    window.PopupUI = PopupUI;
    window.PopupLogic = PopupLogic;

    PopupUI.init(uiRefs);
    PopupLogic.refreshData();

    // Listeners
    uiRefs.showCreateUiBtn.addEventListener('click', () => PopupLogic.startCreate());
    uiRefs.cancelCreateBtn.addEventListener('click', () => PopupUI.toggleView(false));
    uiRefs.confirmCreateBtn.addEventListener('click', () => PopupLogic.handleSave(uiRefs.nameInput.value));
    
    uiRefs.confirmDeleteBtn.addEventListener('click', () => PopupLogic.confirmDelete());
    uiRefs.cancelDeleteBtn.addEventListener('click', () => PopupUI.hideDeleteModal());

    uiRefs.optionsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiRefs.optionsDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => uiRefs.optionsDropdown.classList.add('hidden'));

    uiRefs.saveWindowBtn.addEventListener('click', () => PopupLogic.startCreate('save-window'));

    uiRefs.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') PopupLogic.handleSave(uiRefs.nameInput.value);
        if (e.key === 'Escape') PopupUI.toggleView(false);
    });
});