/**
 * Event Bus
 * Decouples Business Logic (Manager) from UI/Side Effects (Indicator/Menus).
 */

const EventBus = {
    listeners: {},

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`EventBus: Error in listener for ${event}`, e);
                }
            });
        }
    }
};

// Event Constants
const Events = {
    WORKSPACE_OPENED: 'WORKSPACE_OPENED',
    WORKSPACE_UPDATED: 'WORKSPACE_UPDATED', // Name/Color change
    WINDOW_LINKED: 'WINDOW_LINKED'          // Capture/Hydration
};
