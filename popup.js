/*
IMPORTANT: You must include debug.js BEFORE this script in your HTML (or bundle)!
This ensures the global DEBUG flag and debugLog function are available for debug logging.
If debug.js is not loaded first, debug logging will not work and you may see ReferenceError exceptions.

Commenting was reviewed but primarly performed by Cursor. Feel free to add your own comments if more clarity is needed.

 Logic for the Popup page of Tab Modifier Extension
 This script manages the popup UI, including stats and navigation to the options page.
 DOM elements referenced here must exist in popup.html.

 Note: The rules displayed here are managed in options.js and used by content.js.
*/

// --- DOM ELEMENT REFERENCES ---
// These must match the IDs/classes in popup.html
const settingsBtn = document.getElementById('settingsBtn'); // Settings (gear) icon
const unverifiedCount = document.getElementById('unverifiedCount'); // Unverified stat box
const verifiedCount = document.getElementById('verifiedCount');     // Verified stat box
const addRuleBtn = document.getElementById('addRuleBtn');           // Add Rule button

// Log missing DOM elements for debugging
if (!settingsBtn) console.error('Missing DOM element: settingsBtn');
if (!unverifiedCount) console.error('Missing DOM element: unverifiedCount');
if (!verifiedCount) console.error('Missing DOM element: verifiedCount');
if (!addRuleBtn) console.error('Missing DOM element: addRuleBtn');

// --- NAVIGATION ---
// Open options page when settings icon or any stat box is clicked
// This allows users to quickly access rule management
function openOptionsPage() {
    debugLog('Attempting to open options page');
    // First try to open the options page directly
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage(() => {
            // If that fails, try opening it as a new tab
            if (chrome.runtime.lastError) {
                console.error('Error opening options page:', chrome.runtime.lastError);
                debugLog('Failed to open options page directly, trying new tab');
                chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error creating options tab:', chrome.runtime.lastError);
                        debugLog('Failed to create new tab, trying to find existing options page');
                        // Last resort: try to find and focus an existing options page
                        chrome.tabs.query({ url: chrome.runtime.getURL('options.html') }, (tabs) => {
                            if (tabs.length > 0) {
                                debugLog('Found existing options page, focusing it');
                                chrome.tabs.update(tabs[0].id, { active: true });
                            } else {
                                debugLog('No existing options page found');
                            }
                        });
                    }
                });
            }
        });
    } else {
        // Fallback if openOptionsPage is not available
        debugLog('openOptionsPage not available, using fallback');
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
}

// Add click handlers with error handling
function addClickHandler(element) {
    if (element) {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            openOptionsPage();
        });
    }
}

// Add handlers to all navigation elements
addClickHandler(settingsBtn);
addClickHandler(unverifiedCount);
addClickHandler(verifiedCount);

// --- STATS ---
// Fetch rules from chrome.storage and update the stat boxes
// These rules are managed in options.js and used by content.js
chrome.storage.local.get('rules', (result) => {
    if (chrome.runtime.lastError) {
        console.error('Error loading rules from storage:', chrome.runtime.lastError);
        debugLog('Failed to load rules from storage');
    }
    const rules = result.rules || [];
    debugLog('Loaded rules from storage:', rules.length);
    let unverified = 0, verified = 0, errors = 0;
    rules.forEach(rule => {
        if (rule.error) {
            errors++;
        } else if (rule.verifiedTitle) {
            verified++;
        } else if (rule.verificationAttempted) {
            errors++;
        } else {
            unverified++;
        }
    });
    if (unverifiedCount) unverifiedCount.textContent = unverified;
    if (verifiedCount) verifiedCount.textContent = verified;
    debugLog('Updated stats:', { unverified, verified });
});

// --- ADD RULE BUTTON ---
// Opens the options page to add a new rule for the current page
// Pre-fills the URL of the current tab when adding a new rule
if (addRuleBtn) {
    addRuleBtn.addEventListener('click', () => {
        // Get the current tab's URL
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                console.error('Error querying tabs:', chrome.runtime.lastError);
            }
            if (!tabs || !tabs[0] || !tabs[0].url) {
                console.error('Could not get current tab URL for prefill');
                openOptionsPage();
                return;
            }
            
            const urlToPrefill = tabs[0].url;
            
            // Check if options page is already open
            chrome.tabs.query({ url: chrome.runtime.getURL('options.html') }, (optionsTabs) => {
                if (optionsTabs.length > 0) {
                    // Options page is open, send message directly to the tab
                    const sendPrefillMessage = () => {
                        chrome.tabs.sendMessage(optionsTabs[0].id, {
                            action: 'prefillUrl',
                            url: urlToPrefill
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error('Error sending prefillUrl message:', chrome.runtime.lastError);
                                // If message fails, try opening a new options page with URL parameter
                                chrome.runtime.openOptionsPage(() => {
                                    chrome.tabs.query({ url: chrome.runtime.getURL('options.html') }, (newTabs) => {
                                        if (newTabs.length > 0) {
                                            chrome.tabs.update(newTabs[0].id, {
                                                url: chrome.runtime.getURL(`options.html?url=${encodeURIComponent(urlToPrefill)}`)
                                            });
                                        }
                                    });
                                });
                            } else {
                                console.log('Sent prefillUrl message:', urlToPrefill);
                            }
                        });
                    };

                    // Try sending the message immediately
                    sendPrefillMessage();
                    
                    // Focus the options page
                    chrome.tabs.update(optionsTabs[0].id, { active: true });
                } else {
                    // Options page is not open, open it with URL parameter
                    chrome.runtime.openOptionsPage(() => {
                        // Add URL parameter to the options page
                        chrome.tabs.query({ url: chrome.runtime.getURL('options.html') }, (newTabs) => {
                            if (newTabs.length > 0) {
                                chrome.tabs.update(newTabs[0].id, {
                                    url: chrome.runtime.getURL(`options.html?url=${encodeURIComponent(urlToPrefill)}`)
                                });
                            }
                        });
                    });
                }
            });
        });
    });
}