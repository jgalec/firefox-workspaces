/**
 * Logger
 *
 * - `debug`: original gated logger (DEBUG).
 * - `trace`: structured diagnostic tracing shared by background, popup, and options.
 *   It only observes; it must never change behavior.
 *
 * Line format: [WS] <ISO time> <context> <scope>.<event> <JSON data>
 * Set TRACE to false to silence all traces.
 */
const DEBUG = false;
const TRACE = true;
const TRACE_MAX_STRING = 300;

const LOG_CONTEXT = (() => {
    const path = (typeof location !== 'undefined' && location.pathname) || '';
    if (path.includes('/popup/')) return 'popup';
    if (path.includes('/options/')) return 'options';
    return 'background';
})();

function traceReplacer(key, value) {
    if (typeof value === 'string' && value.length > TRACE_MAX_STRING) {
        return `${value.slice(0, TRACE_MAX_STRING)}...(${value.length})`;
    }
    if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: String(value.stack || '').slice(0, TRACE_MAX_STRING) };
    }
    if (value instanceof Set) {
        return Array.from(value);
    }
    return value;
}

const Logger = {
    context: LOG_CONTEXT,

    debug(...args) {
        if (DEBUG) {
            console.log(...args);
        }
    },

    trace(scope, event, data) {
        if (!TRACE) return;
        const prefix = `[WS] ${new Date().toISOString()} ${this.context} ${scope}.${event}`;
        try {
            console.log(data === undefined ? prefix : `${prefix} ${JSON.stringify(data, traceReplacer)}`);
        } catch (error) {
            console.log(`${prefix} (data not serializable: ${error && error.message})`);
        }
    }
};

if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('error', (event) => {
        Logger.trace('global', 'error', { message: event.message, source: event.filename, line: event.lineno });
    });
    globalThis.addEventListener('unhandledrejection', (event) => {
        Logger.trace('global', 'unhandledrejection', { reason: event.reason });
    });
}
