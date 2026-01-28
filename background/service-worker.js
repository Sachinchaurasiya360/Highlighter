/**
 * Background service worker for context menus and keyboard commands
 */

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'highlight-menu',
    title: 'Highlight',
    contexts: ['selection']
  });

  // Create color submenu items
  const colors = [
    { id: 'highlight-yellow', title: 'Yellow', color: 'yellow' },
    { id: 'highlight-green', title: 'Green', color: 'green' },
    { id: 'highlight-pink', title: 'Pink', color: 'pink' },
    { id: 'highlight-blue', title: 'Blue', color: 'blue' },
    { id: 'highlight-purple', title: 'Purple', color: 'purple' }
  ];

  colors.forEach(({ id, title }) => {
    chrome.contextMenus.create({
      id: id,
      parentId: 'highlight-menu',
      title: title,
      contexts: ['selection']
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('highlight-')) {
    const color = info.menuItemId.replace('highlight-', '');
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'highlightSelection',
      color: color
    });
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: command
      });
    }
  });
});
