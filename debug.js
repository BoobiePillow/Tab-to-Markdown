/*
IMPORTANT: You must include debug.js BEFORE this script in your HTML (or bundle)!
This ensures the global DEBUG flag and debugLog function are available for debug logging.
If debug.js is not loaded first, debug logging will not work and you may see ReferenceError exceptions.

Set DEBUG to true to enable debug/info logs, false to disable
Global debug flag and logging utility for Tab Modifier Extension
*/

const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) console.log('[TabMod DEBUG]', ...args);
} 