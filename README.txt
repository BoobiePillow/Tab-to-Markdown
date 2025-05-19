# Tabs to Markdown

A Chrome extension that allows you to modify tab titles based on page content. This is stored within your chrome browser so when you visit the page it automatically changes the tab title, you can also copy this table title and the page URL to markdown to allow quick copy + paste actions for notetaking etc. 

There is a built in "CSS Selector Tool" to allow for user friendly selection of CSS.

Enjoy!

## Installation

1. Download or clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and visible in your Chrome toolbar

## Operation

### Basic Usage
- Click the extension icon in your Chrome toolbar to open the popup interface (make sure you bookmark it first if you want it to be always visible)
- Use the popup to see your rule states
- Access the setup/options screen by clicking the cog in the popup window (this is where you manage your rules, create them etc)
- you can also click the "Add rule for Current page" button to quickly fill in the URL part of the form in options

### Features
- Modify tab titles based on page content
- Easy to use CSS selector tool so you dont have to dig through the HTML of the site
- Ability to copy + paste the tab title and URL with markdown


## Debugging & Logging

This extension includes built-in debugging tools to help you troubleshoot issues and understand how it works.

### Quick Start for Debugging
1. Enable debug mode in both locations:
   ```javascript
   // In debug.js (for popup, options, and content scripts)
   const DEBUG = true;  // Turn on detailed logging

   // In background.js (for background script)
   const DEBUG = true;  // Turn on detailed logging
   ```
2. Open Chrome DevTools (F12 or right-click > Inspect)
3. Check the Console tab for logs

### Understanding the Logs
- **Debug/Info Logs**: Messages prefixed with `[TabMod DEBUG]`
  - Only visible when `DEBUG = true` in both locations
  - Show normal operation and state changes
  - Help track what the extension is doing

- **Error Logs**: Red messages in the console
  - Always visible, even when `DEBUG = false`
  - Indicate problems that need attention
  - Show exactly where something went wrong

### What Gets Logged
The extension tracks important events like:
- Rule management (loading, creating, deleting)
- Selector operations (adding, removing)
- Page title changes
- Tab updates
- Script injections
- Missing or invalid selectors

### Adding Custom Logs
If you need more detailed logging:
1. Find the relevant file (popup.js, content.js, etc.)
2. Add your own debug message:
   ```javascript
   debugLog('Your custom message here');
   ```

Remember: Debug mode must be enabled using the quick start section. Set `DEBUG = false` in both `debug.js` and `background.js`if you do not wish for logs :)


By Nathan Bonifacio <3