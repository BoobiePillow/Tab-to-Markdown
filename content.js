// --- HELPER FUNCTIONS ---

// Check if URL matches rule
function doesUrlMatch(url, matchType, value) {
    switch (matchType) {
        case "contains":
            return url.includes(value);
        case "is":
            return url === value;
        case "startsWith":
            return url.startsWith(value);
        case "endsWith":
            return url.endsWith(value);
        default:
            return false;
    }
}

// Helper function to update title and handle verification
function updateTitle(rule, extractedData) {
    // Replace {{placeholder}} in titleChange with extracted values
    let newTitle = rule.titleChange;
    for (const [name, content] of Object.entries(extractedData)) {
        newTitle = newTitle.replaceAll(`{{${name}}}`, content);
    }

    // Set the page title
    document.title = newTitle;
    debugLog('Set new page title:', newTitle);

    // If this is the first time using this rule (no verification attempted yet), show verify banner
    if (!rule.verifiedTitle) {
        // Show verification banner to user
        showVerifyBanner(newTitle, rule.id, () => {
            // Only mark verification as attempted if user confirms
            chrome.storage.local.get("rules", ({ rules = [] }) => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.error('Error loading rules from storage (on verify):', chrome.runtime.lastError);
                    return;
                }
                const ruleIndex = rules.findIndex(r => r.id === rule.id);
                if (ruleIndex !== -1) {
                    rules[ruleIndex].verifiedTitle = true;
                    chrome.storage.local.set({ rules }, () => {
                        if (chrome.runtime && chrome.runtime.lastError) {
                            console.error('Error saving verification state:', chrome.runtime.lastError);
                        } else {
                            debugLog('Title marked as verified:', newTitle);
                        }
                    });
                }
            });
        });
    }
}

// Remove any existing banners
function removeExistingBanners() {
    const banners = document.querySelectorAll('.tabmod-verify-banner');
    banners.forEach(banner => banner.remove());
}

// Show a banner to confirm the title looks correct
function showVerifyBanner(title, ruleId, onConfirm) {
    removeExistingBanners();
    
    const banner = document.createElement("div");
    banner.className = 'tabmod-verify-banner';
    banner.style = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #222;
      color: #fff;
      padding: 15px;
      border-radius: 6px;
      z-index: 99999;
      font-family: sans-serif;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      text-align: center;
      min-width: 300px;
    `;
    banner.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Is the title displaying correctly?</strong><br>
            "${title}"
        </div>
    `;
    const buttonContainer = document.createElement("div");
    buttonContainer.style = "display: flex; gap: 10px; justify-content: center;";
    
    const looksGoodBtn = document.createElement("button");
    looksGoodBtn.textContent = "Looks Good!";
    looksGoodBtn.style = `
      padding: 5px 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    looksGoodBtn.onclick = () => {
        onConfirm();
        banner.remove();
        debugLog('User confirmed title looks good');
    };

    const wrongBtn = document.createElement("button");
    wrongBtn.textContent = "Something's Wrong";
    wrongBtn.style = `
      padding: 5px 10px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    wrongBtn.onclick = () => {
        // Navigate to options page with the rule for editing
        chrome.runtime.sendMessage({
            action: 'openOptionsWithError',
            ruleId: ruleId
        });
        banner.remove();
        debugLog('User reported title issue');
    };

    buttonContainer.appendChild(looksGoodBtn);
    buttonContainer.appendChild(wrongBtn);
    banner.appendChild(buttonContainer);
    document.body.appendChild(banner);
    debugLog('Displayed verify banner');
}

function waitForDynamicContent(selectors) {
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations, obs) => {
            const allElementsFound = selectors.every(selector => 
                document.querySelector(selector)
            );
            
            if (allElementsFound) {
                obs.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// --- MAIN EXECUTION ---

// Since we're using document_idle, the DOM is already ready when this script runs
// Fetch rules from chrome.storage.local (shared with options.js and popup.js)
chrome.storage.local.get("rules", async ({ rules = [] }) => {
    if (chrome.runtime && chrome.runtime.lastError) {
        console.error('Error loading rules from storage:', chrome.runtime.lastError);
    }
    const currentUrl = window.location.href;
    debugLog('Current URL:', currentUrl);

    for (const rule of rules) {
        if (!doesUrlMatch(currentUrl, rule.matchType, rule.urlValue)) {
            continue;
        }
        
        try {
            // Wait for all elements to be available
            await waitForDynamicContent(Object.values(rule.selectors));
            
            // Now process the elements
            const extractedData = {};
            for (const [name, selector] of Object.entries(rule.selectors)) {
                const element = document.querySelector(selector);
                extractedData[name] = element.textContent.trim();
            }
            
            updateTitle(rule, extractedData);
        } catch (error) {
            console.error('Error processing rule:', error);
        }
    }
});