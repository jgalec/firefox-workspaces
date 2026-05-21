/**
 * Destructive Restore Logic (Option 3) - Firefox Style
 */

if (typeof browser === "undefined") {
    var browser = chrome;
}

function generateWorkspaceId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return `ws-${globalThis.crypto.randomUUID()}`;
    }

    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isValidHexColor(color) {
    return color === 'currentColor' || /^#([A-Fa-f0-9]{3}){1,2}$/.test(color);
}

function sanitizeWorkspaceName(name) {
    if (typeof name !== 'string') return 'Untitled Workspace';
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : 'Untitled Workspace';
}

function normalizeWorkspaceColor(color) {
    return isValidHexColor(color) ? color : '#0060df';
}

function normalizeWorkspaceTab(tab) {
    if (!tab || typeof tab !== 'object') return null;

    const rawUrl = typeof tab.url === 'string' ? tab.url.trim() : '';
    const isAllowedUrl = rawUrl.startsWith('http') || rawUrl.startsWith('file') || rawUrl.startsWith('about');
    const url = isAllowedUrl ? rawUrl : 'about:newtab';
    const title = typeof tab.title === 'string' ? tab.title.slice(0, 500) : '';
    const pinned = typeof tab.pinned === 'boolean' ? tab.pinned : false;
    const active = typeof tab.active === 'boolean' ? tab.active : false;
    const cookieStoreId = typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : undefined;

    return {
        url,
        title,
        pinned,
        active,
        cookieStoreId
    };
}

function normalizeWorkspaceGroup(group, tabCount) {
    if (!group || typeof group !== 'object') return null;

    const title = typeof group.title === 'string' ? group.title.slice(0, 120) : '';
    const allowedColors = new Set(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);
    const color = typeof group.color === 'string' && allowedColors.has(group.color) ? group.color : 'blue';
    const collapsed = typeof group.collapsed === 'boolean' ? group.collapsed : false;
    const rawIndices = Array.isArray(group.tabIndices) ? group.tabIndices : [];

    const tabIndices = [...new Set(
        rawIndices.filter(index => Number.isInteger(index) && index >= 0 && index < tabCount)
    )].sort((a, b) => a - b);

    return {
        title,
        color,
        collapsed,
        tabIndices
    };
}

function normalizeWorkspace(workspace) {
    if (!workspace || typeof workspace !== 'object') return null;

    const tabsInput = Array.isArray(workspace.tabs) ? workspace.tabs : [];
    const tabs = tabsInput
        .map(normalizeWorkspaceTab)
        .filter(Boolean);

    const activeIndex = tabs.findIndex(tab => tab.active);
    if (activeIndex >= 0) {
        tabs.forEach((tab, index) => {
            tab.active = index === activeIndex;
        });
    }

    const groupsInput = Array.isArray(workspace.groups) ? workspace.groups : [];
    const groups = groupsInput
        .map(group => normalizeWorkspaceGroup(group, tabs.length))
        .filter(Boolean);

    return {
        id: typeof workspace.id === 'string' && workspace.id.trim() ? workspace.id : generateWorkspaceId(),
        name: sanitizeWorkspaceName(workspace.name),
        color: normalizeWorkspaceColor(workspace.color || 'currentColor'),
        tabs,
        groups,
        windowId: null,
        lastActive: typeof workspace.lastActive === 'number' ? workspace.lastActive : Date.now()
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
            const processed = workspaces
                .map(normalizeWorkspace)
                .filter(Boolean);

            if (processed.length === 0) {
                throw new Error('Invalid data format. No valid workspaces found.');
            }

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
            showStatus('Restore failed: ' + err.message, 'error');
        }
    }

    function showStatus(msg, type) {
        statusText.textContent = msg;
        statusArea.className = `status ${type}`;
        statusArea.classList.remove('hidden');
    }
});
