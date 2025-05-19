/*
IMPORTANT: You must include debug.js BEFORE this script in your HTML (or bundle)!
This ensures the global DEBUG flag and debugLog function are available for debug logging.
If debug.js is not loaded first, debug logging will not work and you may see ReferenceError exceptions.

Commenting was reviewed but primarly performed by Cursor. Feel free to add your own comments if more clarity is needed.

Main logic for the Options page of Tab Modifier Extension
This script manages rule creation, validation, and display.
DOM elements referenced here must exist in options.html.
Some elements (like selectorsContainer) are dynamically populated.

Note: The rules stored here are also read by popup.js and content.js.
*/

// --- DOM ELEMENT REFERENCES ---
// These must match the IDs/classes in options.html
const matchType = document.getElementById("matchType"); // Used for rule matching logic
const urlValue = document.getElementById("urlValue");   // Used for rule matching logic
const selectorsContainer = document.getElementById("selectorsContainer"); // Container for selector pairs
const addSelectorBtn = document.getElementById("addSelector"); // Button to add selector pairs
const titleChange = document.getElementById("titleChange");   // Input for title template
const addRuleBtn = document.getElementById("addRule");       // Button to submit rule
const rulesList = document.getElementById("rulesList");      // Container for displaying rules
const openSelectorBtn = document.getElementById("openSelector"); // Button to open selector tool
const exportRulesBtn = document.getElementById("exportRules"); // Button to export rules
const importRulesBtn = document.getElementById("importRules"); // Button to import rules
const importFileInput = document.getElementById("importFile"); // Hidden file input for import

// Log missing DOM elements for debugging
if (!matchType) console.error('Missing DOM element: matchType');
if (!urlValue) console.error('Missing DOM element: urlValue');
if (!selectorsContainer) console.error('Missing DOM element: selectorsContainer');
if (!addSelectorBtn) console.error('Missing DOM element: addSelectorBtn');
if (!titleChange) console.error('Missing DOM element: titleChange');
if (!addRuleBtn) console.error('Missing DOM element: addRuleBtn');
if (!rulesList) console.error('Missing DOM element: rulesList');
if (!openSelectorBtn) console.error('Missing DOM element: openSelectorBtn');
if (!exportRulesBtn) console.error('Missing DOM element: exportRulesBtn');
if (!importRulesBtn) console.error('Missing DOM element: importRulesBtn');
if (!importFileInput) console.error('Missing DOM element: importFileInput');

// --- INITIAL LOAD ---
let isOptionsPageReady = false;

// Load existing rules from chrome.storage when the page opens
chrome.storage.local.get("rules", (result) => {
    if (chrome.runtime.lastError) {
        console.error('Error loading rules from storage:', chrome.runtime.lastError);
    }
    const rules = result.rules || [];
    console.log('Loaded rules:', rules);
    renderRules(rules); // show rules in the UI
    addSelectorBtn.click(); // Add one default selector row when the page opens
    isOptionsPageReady = true; // Mark the page as ready to receive messages
});

// Check for URL parameter on load to prefill the URL value from the popup menu button
const urlParams = new URLSearchParams(window.location.search);
const prefillUrl = urlParams.get('url');
if (prefillUrl) {
    urlValue.value = decodeURIComponent(prefillUrl);
}

// Listen for direct URL prefill messages (when page is already open)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'prefillUrl') {
        if (!isOptionsPageReady) {
            // If page isn't ready, store the URL and set it when ready
            setTimeout(() => {
                urlValue.value = message.url;
            }, 100);
        } else {
            urlValue.value = message.url;
        }
        // Send response to acknowledge receipt
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
});

// --- ADD SELECTOR PAIR ---
// When the user clicks "+ Add Another CSS Selector", add a new row
// Each row contains two inputs (name and selector) and a remove button
addSelectorBtn.addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "selectorPair";
    div.innerHTML = `
          <input type="text" placeholder="Humanized Name" class="selectorName" />
          <input type="text" placeholder="CSS Selector" class="selectorValue" />
          <button type="button" class="removeSelector">×</button>
        `;
    // Remove CSS Selector row with click
    div.querySelector(".removeSelector").addEventListener("click", () => {
        div.remove();
        console.log('Removed selector pair row');
    });
    selectorsContainer.appendChild(div);
    console.log('Added selector pair row');
});

// --- ADD RULE FORM SUBMISSION ---
// Handles validation and saving of a new rule
document.getElementById("ruleForm").addEventListener("submit", (e) => {
    e.preventDefault();
    // Defensive: log if selectorsContainer is missing
    if (!selectorsContainer) {
        console.error('selectorsContainer missing on form submit');
        return;
    }

    const selectorInputs = selectorsContainer.querySelectorAll(".selectorPair");
    const selectors = {};
    let valid = true;

    // Gather all selectors (name-value pairs)
    selectorInputs.forEach(pair => {
        const name = pair.querySelector(".selectorName").value.trim();
        const value = pair.querySelector(".selectorValue").value.trim();
        if (name && value) {
            selectors[name] = value;
        } else {
            valid = false;
        }
    });

    if (!valid) {
        alert("Please fill in all fields for each selector pair.");
        console.warn('Form submission blocked: missing selector pair fields');
        return;
    }

    const titleTemplate = titleChange.value;

    // Step 2: Extract all {{placeholders}} used in titleChange
    // These must match the selector names
    const usedPlaceholders = [...titleTemplate.matchAll(/\{\{(.*?)\}\}/g)].map(match => match[1]);

    // Check for unknown placeholders (used in title but not defined as selector)
    const unknown = usedPlaceholders.filter(name => !(name in selectors));
    if (unknown.length > 0) {
        alert(`The following names used in your title template don't have matching selector pairs: ${unknown.join(", ")}
\nPlease add selector pairs with these names. Remember to use the exact same name in both places.`);
        console.warn('Unknown placeholders in title template:', unknown);
        return;
    }

    // Check for unused selectors (defined as selector but not used in title)
    const unused = Object.keys(selectors).filter(name => !usedPlaceholders.includes(name));
    if (unused.length > 0) {
        alert(`You have defined selector pairs that aren't used in your title template: ${unused.join(", ")}
\nEither use these names in your title template (like {{${unused[0]}}}) or remove the unused selector pairs.`);
        console.warn('Unused selector pairs:', unused);
        return;
    }

    // Step 4: All good, save the rule
    const newRule = {
        id: crypto.randomUUID(), // Add unique ID for each rule
        matchType: matchType.value,
        urlValue: urlValue.value,
        selectors: selectors,
        titleChange: titleTemplate,
        verifiedTitle: false
    };

    chrome.storage.local.get("rules", (result) => {
        if (chrome.runtime.lastError) {
            console.error('Error loading rules from storage (on save):', chrome.runtime.lastError);
        }
        const rules = result.rules || [];

        // Check if we're editing an existing rule
        const addRuleBtn = document.getElementById("addRule");
        const editIndex = addRuleBtn.dataset.editIndex;

        if (editIndex !== undefined) {
            // Update existing rule
            rules[editIndex] = {
                ...newRule,
                id: rules[editIndex].id, // Preserve the original ID
            };
            // Reset the button
            addRuleBtn.textContent = "Add Rule";
            delete addRuleBtn.dataset.editIndex;
        } else {
            // Add new rule
            rules.push(newRule);
        }

        chrome.storage.local.set({ rules }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving rules to storage:', chrome.runtime.lastError);
            } else {
                console.log('Rule saved:', newRule);
            }
            renderRules(rules);
            clearInputs();
        });
    });
});

// --- RENDER RULES ---
// Display all rules in the UI (used after add/delete)
// This is only for the options page; popup.js uses its own summary
function renderRules(rules) {
    rulesList.innerHTML = ""; // clear the old list
    // Defensive: log if rules is not an array
    if (!Array.isArray(rules)) {
        console.error('renderRules called with non-array:', rules);
        return;
    }
    // Create a new list item for each rule
    rules.forEach((rule, index) => {
        const div = document.createElement("div");
        div.className = "rule";
        // Clean up the rule text to make it more readable in the UI
        div.innerHTML = `
        <strong>Match:</strong> ${rule.matchType} "<code>${rule.urlValue}</code>"<br>
        <strong>Title:</strong> "${rule.titleChange}"<br>
        <strong>Status:</strong> ${
                    rule.verifiedTitle ?
                        `<span style="color: #28a745;">Verified</span>` :
                        `<span style="color: #6c757d;">Not yet verified</span>`
        }<br>
        <strong>Selectors:</strong><br>
        <ul>
          ${Object.entries(rule.selectors || {}).map(
                ([name, sel]) => `<li><code>${name}</code>: <code>${sel}</code></li>`
            ).join("")}
        </ul>
      `;

        // Add edit and delete buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "rule-buttons";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-rule";
        editBtn.onclick = () => {
            // Populate form with rule data
            matchType.value = rule.matchType;
            urlValue.value = rule.urlValue;
            titleChange.value = rule.titleChange;

            // Clear existing selectors
            selectorsContainer.innerHTML = "";

            // Add selector pairs
            Object.entries(rule.selectors).forEach(([name, selector]) => {
                const div = document.createElement("div");
                div.className = "selectorPair";
                div.innerHTML = `
                        <input type="text" placeholder="Humanized Name" class="selectorName" value="${name}" />
                        <input type="text" placeholder="CSS Selector" class="selectorValue" value="${selector}" />
                        <button type="button" class="removeSelector">×</button>
                    `;
                // Remove CSS Selector row with click
                div.querySelector(".removeSelector").addEventListener("click", () => {
                    div.remove();
                    console.log('Removed selector pair row');
                });
                selectorsContainer.appendChild(div);
            });

            // Change add rule button to update
            const addRuleBtn = document.getElementById("addRule");
            addRuleBtn.textContent = "Update Rule";
            addRuleBtn.dataset.editIndex = index;

            // Scroll to form
            document.querySelector(".centered-container").scrollIntoView({ behavior: "smooth" });
        };

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "delete-rule";
        delBtn.onclick = () => {
            rules.splice(index, 1); // remove the rule from the array
            chrome.storage.local.set({ rules }, () => renderRules(rules)); // save the updated rules
            if (chrome.runtime.lastError) {
                console.error('Error deleting rule from storage:', chrome.runtime.lastError);
            } else {
                console.log('Rule deleted at index', index);
            }
        };

        buttonContainer.appendChild(editBtn);
        buttonContainer.appendChild(delBtn);
        div.appendChild(buttonContainer);
        rulesList.appendChild(div);
    });
}

// --- CLEAR INPUTS ---
// Resets the form after adding a rule
function clearInputs() {
    urlValue.value = "";
    selectorsContainer.innerHTML = "";
    titleChange.value = "";
    addSelectorBtn.click(); // Add one default selector row after clearing the inputs
}

// --- CSS SELECTOR TOOL FUNCTIONALITY ---
openSelectorBtn.addEventListener('click', async () => {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Filter out Chrome internal pages and create a list of valid tabs
    const validTabs = tabs.filter(tab => {
        const url = tab.url.toLowerCase();
        return !url.startsWith('chrome://') && 
               !url.startsWith('chrome-extension://') && 
               !url.startsWith('chrome-search://') &&
               !url.startsWith('chrome-devtools://') &&
               !url.startsWith('chrome-untrusted://') &&
               !url.startsWith('edge://') &&
               !url.startsWith('about:');
    });
    
    if (validTabs.length === 0) {
        alert('Please open the page you want to select elements from in a new tab.');
        return;
    }

    // Create a select element for tab selection
    const select = document.createElement('select');
    select.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e1e28;
        color: #f3f3f3;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #232336;
        font-size: 14px;
        z-index: 999999;
        width: 400px;
        max-width: 90%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;

    // Add a default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a tab to inspect...';
    select.appendChild(defaultOption);

    // Add all valid tabs
    validTabs.forEach(tab => {
        const option = document.createElement('option');
        option.value = tab.id;
        // Truncate the URL if it's too long
        const displayUrl = tab.url.length > 50 ? tab.url.substring(0, 47) + '...' : tab.url;
        option.textContent = `${tab.title || 'Untitled'} (${displayUrl})`;
        select.appendChild(option);
    });

    // Create an overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 999998;
    `;

    // Add click handler to close the overlay
    overlay.addEventListener('click', () => {
        overlay.remove();
        select.remove();
    });

    // Add the elements to the page
    document.body.appendChild(overlay);
    document.body.appendChild(select);

    // Handle tab selection
    select.addEventListener('change', async (e) => {
        const tabId = parseInt(e.target.value);
        if (!tabId) return;

        try {
            // Remove the overlay and select
            overlay.remove();
            select.remove();

            // Switch to the selected tab
            await chrome.tabs.update(tabId, { active: true });
            
            // Inject the selector banner script
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: () => {
                    // Create the info overlay
                    const infoOverlay = document.createElement('div');
                    infoOverlay.style.cssText = `
                        position: fixed;
                        top: 20px;
                        left: 20px;
                        background: #1e1e28;
                        color: #f3f3f3;
                        padding: 12px;
                        border-radius: 8px;
                        border: 1px solid #232336;
                        font-size: 14px;
                        z-index: 2147483647;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        max-width: 400px;
                        pointer-events: none;
                    `;

                    // Create the navigation box
                    const navBox = document.createElement('div');
                    navBox.style.cssText = `
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #1e1e28;
                        color: #f3f3f3;
                        padding: 12px;
                        border-radius: 8px;
                        border: 1px solid #232336;
                        font-size: 14px;
                        z-index: 2147483647;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        display: flex;
                        gap: 8px;
                    `;

                    // Create navigation buttons
                    const upButton = document.createElement('button');
                    upButton.textContent = '↑ Parent';
                    upButton.style.cssText = `
                        padding: 6px 12px;
                        background: #232336;
                        color: #f3f3f3;
                        border: 1px solid #353556;
                        border-radius: 4px;
                        cursor: pointer;
                    `;

                    const downButton = document.createElement('button');
                    downButton.textContent = '↓ Child';
                    downButton.style.cssText = upButton.style.cssText;

                    const selectButton = document.createElement('button');
                    selectButton.textContent = '✓ Select';
                    selectButton.style.cssText = `
                        padding: 6px 12px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    `;

                    // Create the close button
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Cancel';
                    closeButton.style.cssText = `
                        padding: 6px 12px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    `;

                    // Add buttons to nav box
                    navBox.appendChild(upButton);
                    navBox.appendChild(downButton);
                    navBox.appendChild(selectButton);
                    navBox.appendChild(closeButton);

                    let currentElement = null;
                    let isLocked = false;  // Add lock state

                    // Function to update info overlay
                    function updateInfo(element) {
                        if (!element) return;
                        
                        const tagName = element.tagName.toLowerCase();
                        const id = element.id ? `#${element.id}` : '';
                        const classes = Array.from(element.classList).map(c => `.${c}`).join('');
                        const text = element.textContent.trim().substring(0, 50) + (element.textContent.length > 50 ? '...' : '');
                        
                        infoOverlay.innerHTML = `
                            <div style="margin-bottom: 8px;">
                                <strong>Element:</strong> ${tagName}${id}${classes}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Text:</strong> ${text}
                            </div>
                            <div style="font-size: 12px; color: #888;">
                                ${isLocked ? 'Use arrows to navigate, Enter to select' : 'Click to select, use arrows to navigate'}
                            </div>
                        `;

                        // Position the overlay above the element
                        const rect = element.getBoundingClientRect();
                        const overlayRect = infoOverlay.getBoundingClientRect();
                        
                        // Calculate position
                        let top = rect.top - overlayRect.height - 10; // 10px gap
                        let left = rect.left;
                        
                        // Ensure it stays within viewport
                        if (top < 0) {
                            // If it would go above viewport, position below element instead
                            top = rect.bottom + 10;
                        }
                        if (left + overlayRect.width > window.innerWidth) {
                            left = window.innerWidth - overlayRect.width - 10;
                        }
                        if (left < 10) {
                            left = 10;
                        }
                        
                        infoOverlay.style.top = `${top}px`;
                        infoOverlay.style.left = `${left}px`;
                    }

                    // Function to highlight element
                    function highlightElement(element) {
                        if (currentElement) {
                            currentElement.style.outline = '';
                        }
                        currentElement = element;
                        if (element) {
                            element.style.outline = '2px solid #4CAF50';
                            updateInfo(element);
                        }
                    }

                    // Function to navigate to parent
                    function navigateToParent(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (currentElement && currentElement.parentElement) {
                            highlightElement(currentElement.parentElement);
                        }
                    }

                    // Function to navigate to child
                    function navigateToChild(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (currentElement && currentElement.firstElementChild) {
                            highlightElement(currentElement.firstElementChild);
                        }
                    }

                    // Function to generate selector
                    function generateSelector(element) {
                        if (!element) return '';
                        
                        // Special handling for table cells
                        if (element.tagName.toLowerCase() === 'td' || element.tagName.toLowerCase() === 'th') {
                            const row = element.parentElement;
                            const table = row.closest('table');
                            
                            if (table) {
                                // Get row index
                                const rowIndex = Array.from(table.querySelectorAll('tr')).indexOf(row) + 1;
                                
                                // Get column index
                                const cellIndex = Array.from(row.children).indexOf(element) + 1;
                                
                                // Try to find a unique identifier for the table
                                let tableSelector = '';
                                if (table.id) {
                                    tableSelector = `#${table.id}`;
                                } else if (table.classList.length > 0) {
                                    const classSelector = Array.from(table.classList)
                                        .map(c => `.${c}`)
                                        .join('');
                                    if (document.querySelectorAll(classSelector).length === 1) {
                                        tableSelector = classSelector;
                                    }
                                }
                                
                                // If we found a unique table selector, use it
                                if (tableSelector) {
                                    return `${tableSelector} tr:nth-child(${rowIndex}) td:nth-child(${cellIndex})`;
                                }
                                
                                // Fallback to a more generic selector
                                return `table tr:nth-child(${rowIndex}) td:nth-child(${cellIndex})`;
                            }
                        }
                        
                        // Try ID first
                        if (element.id) {
                            return `#${element.id}`;
                        }
                        
                        // Try classes
                        if (element.classList.length > 0) {
                            const classSelector = Array.from(element.classList)
                                .map(c => `.${c}`)
                                .join('');
                            if (document.querySelectorAll(classSelector).length === 1) {
                                return classSelector;
                            }
                        }
                        
                        // Try tag name with nth-child
                        const tagName = element.tagName.toLowerCase();
                        const parent = element.parentElement;
                        if (parent) {
                            const siblings = Array.from(parent.children);
                            const index = siblings.indexOf(element) + 1;
                            return `${tagName}:nth-child(${index})`;
                        }
                        
                        return '';
                    }

                    // Event handlers
                    const mouseoverHandler = function(e) {
                        // Don't highlight if mouse is over navigation box or info overlay
                        if (navBox.contains(e.target) || infoOverlay.contains(e.target)) {
                            return;
                        }
                        // Only highlight on hover if not locked
                        if (!isLocked) {
                            highlightElement(e.target);
                        }
                    };

                    const mouseoutHandler = function(e) {
                        // Don't remove highlight if mouse is over navigation box or info overlay
                        if (navBox.contains(e.target) || infoOverlay.contains(e.target)) {
                            return;
                        }
                        // Only remove highlight if not locked
                        if (!isLocked && currentElement) {
                            currentElement.style.outline = '';
                        }
                    };

                    const clickHandler = function(e) {
                        // Don't handle clicks on navigation box or info overlay
                        if (navBox.contains(e.target) || infoOverlay.contains(e.target)) {
                            return;
                        }

                        e.preventDefault();
                        e.stopPropagation();
                        highlightElement(e.target);
                        isLocked = true;  // Lock the selection
                        updateInfo(currentElement);  // Update the info text
                    };

                    const keydownHandler = function(e) {
                        switch (e.key) {
                            case 'ArrowUp':
                                navigateToParent(e);
                                break;
                            case 'ArrowDown':
                                navigateToChild(e);
                                break;
                            case 'Enter':
                                if (currentElement) {
                                    const selector = generateSelector(currentElement);
                                    chrome.runtime.sendMessage({
                                        action: 'selectorSelected',
                                        selector: selector
                                    });
                                    cleanup();
                                }
                                break;
                            case 'Escape':
                                cleanup();
                                chrome.runtime.sendMessage({
                                    action: 'selectorCancelled'
                                });
                                break;
                        }
                    };

                    // Add event listeners
                    document.addEventListener('mouseover', mouseoverHandler, true);
                    document.addEventListener('mouseout', mouseoutHandler, true);
                    document.addEventListener('click', clickHandler, true);
                    document.addEventListener('keydown', keydownHandler);

                    // Add button handlers with proper event prevention
                    upButton.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigateToParent(e);
                    };
                    downButton.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigateToChild(e);
                    };
                    selectButton.onclick = () => {
                        if (currentElement) {
                            const selector = generateSelector(currentElement);
                            chrome.runtime.sendMessage({
                                action: 'selectorSelected',
                                selector: selector
                            });
                            cleanup();
                        }
                    };
                    closeButton.onclick = () => {
                        cleanup();
                        chrome.runtime.sendMessage({
                            action: 'selectorCancelled'
                        });
                    };

                    // Function to cleanup
                    function cleanup() {
                        // Remove event listeners
                        document.removeEventListener('mouseover', mouseoverHandler, true);
                        document.removeEventListener('mouseout', mouseoutHandler, true);
                        document.removeEventListener('click', clickHandler, true);
                        document.removeEventListener('keydown', keydownHandler);
                        
                        // Remove elements
                        infoOverlay.remove();
                        navBox.remove();
                        
                        // Remove any existing outlines
                        document.querySelectorAll('*').forEach(el => {
                            el.style.outline = '';
                        });
                        
                        // Reset state
                        currentElement = null;
                        isLocked = false;
                    }

                    // Add elements to page
                    document.body.appendChild(infoOverlay);
                    document.body.appendChild(navBox);
                }
            });
        } catch (error) {
            console.error('Error starting element selection:', error);
            
            // Show error banner
            const errorBanner = document.createElement('div');
            errorBanner.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #dc3545;
                color: white;
                padding: 15px;
                border-radius: 6px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 400px;
            `;
            errorBanner.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Unable to start element selection</div>
                <div style="font-size: 14px; margin-bottom: 12px;">Please try again or select a different tab.</div>
                <button style="
                    background: white;
                    color: #dc3545;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: 500;
                ">Try Again</button>
            `;
            
            // Add try again button handler
            const tryAgainBtn = errorBanner.querySelector('button');
            tryAgainBtn.onclick = () => {
                errorBanner.remove();
                // Re-trigger the selector tool
                openSelectorBtn.click();
            };

            document.body.appendChild(errorBanner);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorBanner.parentNode) {
                    errorBanner.remove();
                }
            }, 5000);
        }
    });
});

// Update the message listener to handle returning to options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'selectorSelected') {
        // Find the last active selector input
        const selectorInputs = selectorsContainer.querySelectorAll('.selectorValue');
        const lastInput = selectorInputs[selectorInputs.length - 1];
        if (lastInput) {
            lastInput.value = message.selector;
            // Trigger input event to update any listeners
            lastInput.dispatchEvent(new Event('input'));
            
            // Show success message
            const successBanner = document.createElement('div');
            successBanner.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #28a745;
                color: white;
                padding: 16px;
                border-radius: 8px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 400px;
            `;
            successBanner.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Element selected successfully!</div>
                <div style="font-size: 14px;">The selector has been added to your rule.</div>
            `;
            document.body.appendChild(successBanner);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (successBanner.parentNode) {
                    successBanner.remove();
                }
            }, 3000);

            // Clean up the target tab before switching
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                function: () => {
                    // Remove any existing banners
                    document.querySelectorAll('div[style*="position: fixed"]').forEach(el => el.remove());
                    // Remove any outlines
                    document.querySelectorAll('*').forEach(el => {
                        el.style.outline = '';
                        el.style.outlineOffset = '';
                    });
                    // Remove event listeners
                    document.removeEventListener('mouseover', null, true);
                    document.removeEventListener('mouseout', null, true);
                    document.removeEventListener('click', null, true);
                }
            }).then(() => {
                // Find and switch to the options page
                chrome.tabs.query({}, (tabs) => {
                    const optionsTab = tabs.find(tab => tab.url.startsWith('chrome-extension://') && tab.url.includes('options.html'));
                    if (optionsTab) {
                        chrome.tabs.update(optionsTab.id, { active: true });
                    }
                });
            });
        }
    } else if (message.action === 'selectorCancelled') {
        // Clean up the target tab before switching
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            function: () => {
                // Remove any existing banners
                document.querySelectorAll('div[style*="position: fixed"]').forEach(el => el.remove());
                // Remove any outlines
                document.querySelectorAll('*').forEach(el => {
                    el.style.outline = '';
                    el.style.outlineOffset = '';
                });
                // Remove event listeners
                document.removeEventListener('mouseover', null, true);
                document.removeEventListener('mouseout', null, true);
                document.removeEventListener('click', null, true);
            }
        }).then(() => {
            // Find and switch to the options page
            chrome.tabs.query({}, (tabs) => {
                const optionsTab = tabs.find(tab => tab.url.startsWith('chrome-extension://') && tab.url.includes('options.html'));
                if (optionsTab) {
                    chrome.tabs.update(optionsTab.id, { active: true });
                }
            });
        });
    } else if (message.action === 'setErrorFilter') {
        // Find the rule with the matching ID
        chrome.storage.local.get('rules', ({ rules = [] }) => {
            const rule = rules.find(r => r.id === message.ruleId);
            if (rule) {
                // Open the rule for editing
                openRuleForEditing(rule);
            }
        });
    }
});

// --- EXPORT RULES ---
exportRulesBtn.addEventListener("click", () => {
    chrome.storage.local.get("rules", (result) => {
        if (chrome.runtime.lastError) {
            console.error('Error loading rules for export:', chrome.runtime.lastError);
            return;
        }
        const rules = result.rules || [];
        
        // Create a blob with the rules data
        const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tab-modifier-rules.json';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});

// --- IMPORT RULES ---
importRulesBtn.addEventListener("click", () => {
    importFileInput.click();
});

importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedRules = JSON.parse(event.target.result);
            
            // Validate the imported data
            if (!Array.isArray(importedRules)) {
                throw new Error('Imported data must be an array of rules');
            }

            // Validate each rule has required fields
            const requiredFields = ['matchType', 'urlValue', 'selectors', 'titleChange'];
            importedRules.forEach((rule, index) => {
                requiredFields.forEach(field => {
                    if (!(field in rule)) {
                        throw new Error(`Rule at index ${index} is missing required field: ${field}`);
                    }
                });
            });

            // Save the imported rules
            chrome.storage.local.set({ rules: importedRules }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving imported rules:', chrome.runtime.lastError);
                    alert('Error importing rules. Please try again.');
                    return;
                }
                renderRules(importedRules);
                alert('Rules imported successfully!');
            });
        } catch (error) {
            console.error('Error importing rules:', error);
            alert('Error importing rules: ' + error.message);
        }
        
        // Reset the file input
        e.target.value = '';
    };
    reader.readAsText(file);
});