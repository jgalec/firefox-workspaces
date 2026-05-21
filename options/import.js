/**
 * Destructive Restore Logic (Option 3) - Firefox Style
 */

if (typeof browser === "undefined") {
    var browser = chrome;
}

function isValidHexColor(color) {
    return color === 'currentColor' || /^#([A-Fa-f0-9]{3}){1,2}$/.test(color);
}

const ALLOWED_GROUP_COLORS = new Set(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);

function isAllowedTabUrl(url) {
    return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://') || url.startsWith('about:'));
}

function validateAndNormalizeBackup(workspaces) {
    if (!Array.isArray(workspaces) || workspaces.length === 0) {
        throw new Error('Invalid backup: workspaces must be a non-empty array.');
    }

    return workspaces.map((workspace, wsIndex) => validateAndNormalizeWorkspace(workspace, wsIndex));
}

function toUserFriendlyImportError(error) {
    const technicalMessage = typeof error?.message === 'string' ? error.message : 'Unknown validation error.';
    if (!technicalMessage.startsWith('Invalid backup:')) {
        return `Restore failed: ${technicalMessage}`;
    }

    return `Invalid backup file. Please review the backup format and try again.\n\nDetails: ${technicalMessage}`;
}

function validateAndNormalizeWorkspace(workspace, wsIndex) {
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
        throw new Error(`Invalid backup: workspace[${wsIndex}] must be an object.`);
    }

    if (typeof workspace.id !== 'string' || workspace.id.trim().length === 0) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].id must be a non-empty string.`);
    }

    if (typeof workspace.name !== 'string' || workspace.name.trim().length === 0) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].name must be a non-empty string.`);
    }

    if (!isValidHexColor(workspace.color)) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].color must be a hex value or currentColor.`);
    }

    if (!Array.isArray(workspace.tabs) || workspace.tabs.length === 0) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].tabs must be a non-empty array.`);
    }

    const tabs = workspace.tabs.map((tab, tabIndex) => validateAndNormalizeTab(tab, wsIndex, tabIndex));
    const activeCount = tabs.filter(tab => tab.active).length;
    if (activeCount !== 1) {
        throw new Error(`Invalid backup: workspace[${wsIndex}] must have exactly one active tab.`);
    }

    let groups = [];
    if (workspace.groups !== undefined) {
        if (!Array.isArray(workspace.groups)) {
            throw new Error(`Invalid backup: workspace[${wsIndex}].groups must be an array.`);
        }
        groups = workspace.groups.map((group, groupIndex) => validateAndNormalizeGroup(group, wsIndex, groupIndex, tabs.length));
    }

    return {
        id: workspace.id.trim(),
        name: workspace.name.trim().slice(0, 120),
        color: workspace.color,
        tabs,
        groups,
        windowId: null,
        lastActive: typeof workspace.lastActive === 'number' ? workspace.lastActive : Date.now()
    };
}

function validateAndNormalizeTab(tab, wsIndex, tabIndex) {
    if (!tab || typeof tab !== 'object' || Array.isArray(tab)) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].tabs[${tabIndex}] must be an object.`);
    }

    if (!isAllowedTabUrl(tab.url)) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].tabs[${tabIndex}].url is not allowed.`);
    }

    if (typeof tab.pinned !== 'boolean') {
        throw new Error(`Invalid backup: workspace[${wsIndex}].tabs[${tabIndex}].pinned must be boolean.`);
    }

    if (typeof tab.active !== 'boolean') {
        throw new Error(`Invalid backup: workspace[${wsIndex}].tabs[${tabIndex}].active must be boolean.`);
    }

    if (tab.cookieStoreId !== undefined && typeof tab.cookieStoreId !== 'string') {
        throw new Error(`Invalid backup: workspace[${wsIndex}].tabs[${tabIndex}].cookieStoreId must be a string.`);
    }

    return {
        url: tab.url.trim(),
        title: typeof tab.title === 'string' ? tab.title.slice(0, 500) : '',
        pinned: tab.pinned,
        active: tab.active,
        cookieStoreId: typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : undefined
    };
}

function validateAndNormalizeGroup(group, wsIndex, groupIndex, tabCount) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}] must be an object.`);
    }

    if (typeof group.title !== 'string' || group.title.trim().length === 0) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}].title must be a non-empty string.`);
    }

    if (typeof group.color !== 'string' || !ALLOWED_GROUP_COLORS.has(group.color)) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}].color is invalid.`);
    }

    if (typeof group.collapsed !== 'boolean') {
        throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}].collapsed must be boolean.`);
    }

    if (!Array.isArray(group.tabIndices) || group.tabIndices.length === 0) {
        throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}].tabIndices must be a non-empty array.`);
    }

    const seenIndices = new Set();
    for (const index of group.tabIndices) {
        if (!Number.isInteger(index) || index < 0 || index >= tabCount) {
            throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}] has invalid tab index.`);
        }
        if (seenIndices.has(index)) {
            throw new Error(`Invalid backup: workspace[${wsIndex}].groups[${groupIndex}] has duplicated tab indices.`);
        }
        seenIndices.add(index);
    }

    return {
        title: group.title.trim().slice(0, 120),
        color: group.color,
        collapsed: group.collapsed,
        tabIndices: [...group.tabIndices]
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const closeBtn = document.getElementById('close-btn');
    
    // Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const wsCountDisplay = document.getElementById('ws-count-display');
    const cancelRestoreBtn = document.getElementById('cancel-restore-btn');
    const confirmRestoreBtn = document.getElementById('confirm-restore-btn');

    let pendingWorkspaces = null;

    closeBtn.addEventListener('click', () => window.close());

    // Click to select
    dropZone.addEventListener('click', () => fileInput.click());

    // File selection
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Modal Action Listeners
    cancelRestoreBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        fileInput.value = '';
        pendingWorkspaces = null;
    });

    confirmRestoreBtn.addEventListener('click', async () => {
        if (!pendingWorkspaces) return;
        
        confirmModal.classList.add('hidden');
        await performRestore(pendingWorkspaces);
        pendingWorkspaces = null;
    });

    async function handleFile(file) {
        if (!file) return;
        
        statusArea.classList.add('hidden');
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                const workspacesToImport = Array.isArray(imported) ? imported : imported.workspaces;

                if (!workspacesToImport || !Array.isArray(workspacesToImport)) {
                    showStatus('Error: Invalid backup format.', 'error');
                    return;
                }

                // Show custom modal instead of window.confirm
                pendingWorkspaces = workspacesToImport;
                wsCountDisplay.textContent = workspacesToImport.length;
                confirmModal.classList.remove('hidden');
                
            } catch (err) {
                console.error('Import Error:', err);
                showStatus('Error reading file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    async function performRestore(workspaces) {
        try {
            const processed = validateAndNormalizeBackup(workspaces);

            // DESTROY AND OVERWRITE
            await browser.storage.local.set({ workspaces: processed });
            
            // Notify background to re-hydrate state
            browser.runtime.sendMessage({ 
                type: 'UPDATE_WORKSPACE', 
                workspaceId: 'import_destructive',
                payload: { count: processed.length }
            });

            // Auto-close tab with countdown
            let countdown = 5;
            const updateMsg = () => showStatus(`Success! Restored ${processed.length} workspaces. This tab will close in ${countdown} seconds.`, 'success');
            
            updateMsg();
            
            const interval = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(interval);
                    window.close();
                } else {
                    updateMsg();
                }
            }, 1000);
        } catch (err) {
            showStatus(toUserFriendlyImportError(err), 'error');
        }
    }

    function showStatus(msg, type) {
        statusText.textContent = msg;
        statusArea.className = `status ${type}`;
        statusArea.classList.remove('hidden');
    }
});
