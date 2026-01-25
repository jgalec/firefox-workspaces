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
            console.log('IO: Starting Export (DOM method)...');
            const data = await browser.storage.local.get('workspaces');
            const json = JSON.stringify(data, null, 2);
            
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
            console.error('IO: Export Error:', error); 
            if (window.PopupUI) {
                PopupUI.showMessage('Export Failed', error.message, true);
            } else {
                alert('Export Failed: ' + error.message);
            }
        }
    }
};
