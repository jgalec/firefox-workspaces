/**
 * Destructive Restore Logic (Option 3)
 */

if (typeof browser === "undefined") {
    var browser = chrome;
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const closeBtn = document.getElementById('close-btn');

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

                // DESTRUCTIVE WARNING
                const msg = `CRITICAL WARNING:\n\nThis will PERMANENTLY DELETE your current workspaces and replace them with the ${workspacesToImport.length} workspaces from the backup.\n\nThis action cannot be undone. Do you want to continue?`;
                
                if (!window.confirm(msg)) {
                    fileInput.value = '';
                    return;
                }

                // Process Import: Strip window associations
                const processed = workspacesToImport.map(ws => ({
                    ...ws,
                    windowId: null, // Always reset window linkage
                    id: ws.id || `ws-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                }));

                // DESTROY AND OVERWRITE
                await browser.storage.local.set({ workspaces: processed });
                
                // Notify background to re-hydrate state
                browser.runtime.sendMessage({
                    type: 'UPDATE_WORKSPACE',
                    workspaceId: 'import_destructive',
                    payload: { count: processed.length }
                });

                showStatus(`Success! Restored ${processed.length} workspaces. You can now close this tab.`, 'success');
                
            } catch (err) {
                console.error('Import Error:', err);
                showStatus('Error reading file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    function showStatus(msg, type) {
        statusText.textContent = msg;
        statusArea.className = `status ${type}`;
        statusArea.classList.remove('hidden');
    }
});
