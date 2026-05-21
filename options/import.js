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
            // Security: Validate Schema before processing
            const isValid = workspaces.every(ws => {
                const color = ws.color || "currentColor";
                const isColorValid = color === "currentColor" || /^#([A-Fa-f0-9]{3}){1,2}$/.test(color);
                const areTabsValid = !ws.tabs || Array.isArray(ws.tabs);
                return isColorValid && areTabsValid;
            });

            if (!isValid) {
                throw new Error("Invalid data format. Check colors and structure.");
            }

            // Process Import: Strip window associations
            const processed = workspaces.map(ws => ({
                ...ws,
                windowId: null, // Always reset window linkage
                id: ws.id || generateWorkspaceId()
            }));

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
