// Background script
console.log('Background service started for Firefox Workspaces');

// Example listener for installation
browser.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed or updated:', details.reason);
});