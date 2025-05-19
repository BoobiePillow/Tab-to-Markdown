// Global debug flag and logging utility for Tab Modifier Extension
// (Defined directly in this file because background scripts cannot import or include debug.js directly)
const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) console.log('[TabMod DEBUG]', ...args);
}
/*
NOTE: The debug flag and debugLog are defined directly in this file for background script compatibility.
      In popup/options/content scripts, debug.js is included as a separate file.
      If you bundle scripts in the future, you can unify this logic.

Background script for Tab Modifier Extension
--------------------------------------------
- Listens for tab updates (navigation, reload, etc.)
- Only injects content.js if the tab's URL matches at least one rule defined in options.js
- This enables dynamic tab title modification based on user-defined rules
- Rules are stored in chrome.storage.local and shared with options.js, popup.js, and content.js
*/

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog('Received message:', message.action);
    if (message.action === 'openOptionsWithError') {
        // Open options page with error filter
        chrome.runtime.openOptionsPage(() => {
            debugLog('Opening options page with error filter for rule:', message.ruleId);
            // After options page is opened, send message to set error filter and rule ID
            chrome.runtime.sendMessage({
                action: 'setErrorFilter',
                ruleId: message.ruleId
            });
        });
    }
});

// Listen for tab updates (e.g., navigation, reload)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only run when the page has fully loaded and the tab has a URL
    if (changeInfo.status === 'complete' && tab.url) {
        // Skip chrome:// and chrome-extension:// URLs
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
        }
        
        // Fetch rules from storage (rules are managed in options.js)
        chrome.storage.local.get('rules', (result) => {
            const rules = result.rules || [];
            // Check if the tab's URL matches any rule
            const matchesAnyRule = rules.some(rule => {
                switch (rule.matchType) {
                    case "contains":
                        return tab.url.includes(rule.urlValue);
                    case "is":
                        return tab.url === rule.urlValue;
                    case "startsWith":
                        return tab.url.startsWith(rule.urlValue);
                    case "endsWith":
                        return tab.url.endsWith(rule.urlValue);
                    default:
                        return false;
                }
            });
            if (matchesAnyRule) {
                // Inject content.js only if a rule matches
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["content.js"]
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error injecting content.js:', chrome.runtime.lastError);
                    } else {
                        debugLog('Injected content.js into tab:', tabId, tab.url);
                    }
                });
            } else {
                // No rule matched, so do not inject
                debugLog('Tab updated but no rule matched, not injecting:', tabId, tab.url);
            }
        });
    } else if (changeInfo.status === 'complete') {
        // Defensive: This branch should only run if tab.url is missing (rare)
        debugLog('Tab updated but not injected (no URL present):', tabId, tab.url);
    }
});

// Create context menu item when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "copyTabInfo",
        title: "📋 Copy Tab Name && URL",
        contexts: ["page"]
    });
    debugLog('Context menu item created');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    debugLog('Context menu clicked:', info.menuItemId);
    if (info.menuItemId === "copyTabInfo") {
        // Create a markdown-style link with the tab title and URL
        const markdownLink = `[${tab.title}](${tab.url})`;
        debugLog('Created markdown link:', markdownLink);
        
        // Copy to clipboard using Chrome's clipboard API
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => {
                // Create a temporary input element
                const input = document.createElement('textarea');
                input.style.position = 'fixed';
                input.style.opacity = 0;
                input.value = text;
                document.body.appendChild(input);
                
                // Select and copy the text
                input.select();
                document.execCommand('copy');
                
                // Remove the temporary element
                document.body.removeChild(input);
                
                // Show feedback
                const feedback = document.createElement('div');
                feedback.textContent = 'Copied to clipboard!';
                feedback.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #4CAF50;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 999999;
                    font-family: sans-serif;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(feedback);
                
                // Remove feedback after 2 seconds
                setTimeout(() => {
                    feedback.style.opacity = '0';
                    feedback.style.transition = 'opacity 0.5s';
                    setTimeout(() => feedback.remove(), 500);
                }, 2000);
            },
            args: [markdownLink]
        }).then(() => {
            debugLog('Copied tab info to clipboard:', markdownLink);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
        });
    }
});