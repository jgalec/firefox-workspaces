const DEBUG = false;

const Logger = {
    debug(...args) {
        if (DEBUG) {
            console.log(...args);
        }
    }
};
