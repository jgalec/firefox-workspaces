/**
 * Popup Entry Point
 * Wiring DOM elements to the modules logic.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup: DOM Loaded');

    // 1. Gather References
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
        saveWindowBtn: document.getElementById('save-window-btn'),
        exportWorkspacesBtn: document.getElementById('export-workspaces-btn'),
        restoreWorkspacesBtn: document.getElementById('restore-workspaces-btn'),
        toggleReorderBtn: document.getElementById('toggle-reorder-btn')
    };

    // Global availability
    window.PopupUI = PopupUI;
    window.PopupLogic = PopupLogic;
    window.PopupIO = PopupIO;

    // 2. Initialize
    try {
        PopupUI.init(uiRefs);
        await PopupLogic.refreshData();
    } catch (e) {
        console.error('Popup: Initialization failed', e);
    }

    // 3. Attach Listeners
    uiRefs.showCreateUiBtn.addEventListener('click', () => PopupLogic.startCreate());
    uiRefs.cancelCreateBtn.addEventListener('click', () => PopupUI.toggleView(false));
    uiRefs.confirmCreateBtn.addEventListener('click', () => PopupLogic.handleSave(uiRefs.nameInput.value));
    
    uiRefs.confirmDeleteBtn.addEventListener('click', () => PopupLogic.confirmDelete());
    uiRefs.cancelDeleteBtn.addEventListener('click', () => PopupUI.hideDeleteModal());

    uiRefs.toggleReorderBtn.addEventListener('click', () => {
        uiRefs.workspaceList.classList.toggle('reordering');
        uiRefs.toggleReorderBtn.classList.toggle('active');
        PopupLogic.refreshData();
    });

    uiRefs.optionsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiRefs.optionsDropdown.classList.toggle('hidden');
    });
    
    document.addEventListener('click', () => uiRefs.optionsDropdown.classList.add('hidden'));

    uiRefs.saveWindowBtn.addEventListener('click', () => PopupLogic.startCreate('save-window'));

    // I/O Listeners
    uiRefs.exportWorkspacesBtn.addEventListener('click', () => {
        uiRefs.optionsDropdown.classList.add('hidden');
        PopupIO.exportData();
    });

    uiRefs.restoreWorkspacesBtn.addEventListener('click', () => {
        uiRefs.optionsDropdown.classList.add('hidden');
        browser.tabs.create({ url: browser.runtime.getURL('options/restore.html') });
    });

    uiRefs.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') PopupLogic.handleSave(uiRefs.nameInput.value);
        if (e.key === 'Escape') PopupUI.toggleView(false);
    });
});
