/**
 * Popup IO Module
 * Handles Export of workspace data.
 */

const PopupIO = {
    /**
     * Exports workspaces to a JSON file using DOM method.
     */
    async exportData() {
        try {
            const data = await browser.storage.local.get('workspaces');
            const json = JSON.stringify(data, null, 2);
            Logger.trace('popup-io', 'export', { workspaceCount: (data.workspaces || []).length, bytes: json.length });
            
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `firefox-workspaces-backup-${new Date().toISOString().slice(0, 10)}.json`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Auto-cleanup by browser on popup close
        } catch (error) { 
            Logger.trace('popup-io', 'export-failed', { error, hasShowMessage: !!(window.PopupUI && window.PopupUI.showMessage) });
            console.error('IO: Export Error:', error);
            if (window.PopupUI) {
                PopupUI.showMessage('Export Failed', error.message, true);
            } else {
                alert('Export Failed: ' + error.message);
            }
        }
    }
};
