/**
 * Content script for text highlighting functionality
 */

class TextHighlighter {
  constructor() {
    this.currentUrl = this.normalizeUrl(window.location.href);
    this.highlights = [];
    this.lastColor = 'yellow';
    this.menu = null;
    this.tooltip = null;
    this.colors = ['yellow', 'green', 'pink', 'blue', 'purple'];
    
    this.init();
  }

  async init() {
    // Load settings
    const settings = await StorageManager.getSettings();
    this.lastColor = settings.lastColor || 'yellow';

    // Load and restore highlights
    await this.restoreHighlights();

    // Check for shared highlights in URL
    await this.checkForSharedHighlights();

    // Setup event listeners
    this.setupEventListeners();

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sendResponse);
      return true; // Keep channel open for async response
    });
  }

  normalizeUrl(url) {
    // Remove hash and query params for consistent storage
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  setupEventListeners() {
    // Mouse up for selection
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // Click outside to close menu
    document.addEventListener('mousedown', (e) => {
      if (this.menu && !this.menu.contains(e.target)) {
        this.closeMenu();
      }
    });

    // Hover for tooltips
    document.addEventListener('mouseover', (e) => this.handleMouseOver(e));
    document.addEventListener('mouseout', (e) => this.handleMouseOut(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  handleMouseUp(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0 && !e.target.closest('.text-highlighter-menu')) {
      this.showColorMenu(selection);
    }
  }

  showColorMenu(selection) {
    this.closeMenu();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    this.menu = document.createElement('div');
    this.menu.className = 'text-highlighter-menu';
    this.menu.style.left = `${rect.left + window.scrollX}px`;
    this.menu.style.top = `${rect.bottom + window.scrollY + 5}px`;

    this.colors.forEach(color => {
      const button = document.createElement('button');
      button.className = `text-highlighter-menu-button ${color}`;
      button.title = color.charAt(0).toUpperCase() + color.slice(1);
      button.addEventListener('click', () => {
        this.createHighlight(selection, color);
        this.closeMenu();
      });
      this.menu.appendChild(button);
    });

    document.body.appendChild(this.menu);
  }

  closeMenu() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }

  async createHighlight(selection, color) {
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText) return;

    // Create anchor data
    const anchor = this.createAnchor(range, selectedText);
    if (!anchor) return;

    // Create highlight object
    const highlight = {
      id: this.generateId(),
      text: selectedText,
      color: color,
      note: '',
      timestamp: Date.now(),
      anchor: anchor
    };

    // Apply highlight to DOM
    this.applyHighlight(range, highlight);

    // Save to storage
    this.highlights.push(highlight);
    await StorageManager.addHighlight(this.currentUrl, highlight);

    // Update last color
    this.lastColor = color;
    await StorageManager.updateSettings({ lastColor: color });

    // Clear selection
    selection.removeAllRanges();
  }

  createAnchor(range, text) {
    try {
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;

      // Get XPath for start container
      const xpath = this.getXPath(startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer);

      // Get surrounding context
      const fullText = startContainer.textContent || '';
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;

      const prefix = fullText.substring(Math.max(0, startOffset - 50), startOffset);
      const suffix = fullText.substring(endOffset, Math.min(fullText.length, endOffset + 50));

      return {
        xpath: xpath,
        startOffset: startOffset,
        endOffset: endOffset,
        prefix: prefix,
        suffix: suffix,
        textContent: text
      };
    } catch (error) {
      console.error('Error creating anchor:', error);
      return null;
    }
  }

  getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
      return '/html/body';
    }

    let position = 0;
    let siblings = element.parentNode.childNodes;

    for (let i = 0; i < siblings.length; i++) {
      let sibling = siblings[i];
      if (sibling === element) {
        return this.getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (position + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        position++;
      }
    }
  }

  applyHighlight(range, highlight) {
    try {
      const span = document.createElement('span');
      span.className = `text-highlighter-mark text-highlighter-${highlight.color}`;
      span.dataset.highlightId = highlight.id;
      span.dataset.note = highlight.note || '';

      range.surroundContents(span);

      // Add click listener for action menu
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showActionMenu(e, highlight.id);
      });
    } catch (error) {
      console.error('Error applying highlight:', error);
    }
  }

  async restoreHighlights() {
    this.highlights = await StorageManager.getHighlights(this.currentUrl);

    for (const highlight of this.highlights) {
      this.restoreHighlight(highlight);
    }
  }

  async checkForSharedHighlights() {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('h_share');

    if (shareId) {
      console.log(`Highlighter: Detected shared highlights ID: ${shareId}`);
      const data = await StorageManager.fetchSharedHighlights(shareId);
      
      if (data && data.highlights) {
        console.log(`Highlighter: Applying ${data.highlights.length} shared highlights`);
        
        for (const highlight of data.highlights) {
          // Check if we already have this highlight (avoid duplicates)
          if (!this.highlights.find(h => h.id === highlight.id)) {
            this.restoreHighlight(highlight);
            // We don't necessarily save these to local storage automatically 
            // unless the user edits them or we decide to save all shared ones.
            // For now, let's just display them.
          }
        }
      }
    }
  }

  restoreHighlight(highlight) {
    try {
      // Find element using XPath
      const element = document.evaluate(
        highlight.anchor.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      if (!element) return;

      // Find text node and position
      const textNode = this.findTextNode(element, highlight.anchor);
      if (!textNode) return;

      // Create range
      const range = document.createRange();
      range.setStart(textNode, highlight.anchor.startOffset);
      range.setEnd(textNode, highlight.anchor.endOffset);

      // Apply highlight
      this.applyHighlight(range, highlight);
    } catch (error) {
      console.error('Error restoring highlight:', error);
    }
  }

  findTextNode(element, anchor) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      
      // Try to match using context
      if (text.includes(anchor.textContent)) {
        const index = text.indexOf(anchor.textContent);
        if (index !== -1) {
          // Check prefix/suffix match
          const prefix = text.substring(Math.max(0, index - 50), index);
          const suffix = text.substring(index + anchor.textContent.length, Math.min(text.length, index + anchor.textContent.length + 50));
          
          if (prefix.includes(anchor.prefix.slice(-20)) || suffix.includes(anchor.suffix.slice(0, 20))) {
            return node;
          }
        }
      }
    }

    return null;
  }

  handleMouseOver(e) {
    const mark = e.target.closest('.text-highlighter-mark');
    if (mark && mark.dataset.note) {
      this.showTooltip(mark, mark.dataset.note);
    }
  }

  handleMouseOut(e) {
    const mark = e.target.closest('.text-highlighter-mark');
    if (mark) {
      this.hideTooltip();
    }
  }

  showTooltip(element, note) {
    if (!note) return;

    this.hideTooltip();

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'text-highlighter-tooltip';
    this.tooltip.textContent = note;

    const rect = element.getBoundingClientRect();
    this.tooltip.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltip.style.top = `${rect.top + window.scrollY - 40}px`;
    this.tooltip.style.transform = 'translateX(-50%)';

    document.body.appendChild(this.tooltip);
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  showActionMenu(event, highlightId) {
    // Close any existing menu
    this.closeMenu();

    const mark = event.target.closest('.text-highlighter-mark');
    if (!mark) return;

    const rect = mark.getBoundingClientRect();

    // Create action menu
    this.menu = document.createElement('div');
    this.menu.className = 'text-highlighter-action-menu';
    this.menu.style.left = `${rect.left + window.scrollX}px`;
    this.menu.style.top = `${rect.bottom + window.scrollY + 5}px`;

    // Erase button
    const eraseBtn = document.createElement('button');
    eraseBtn.className = 'text-highlighter-action-button erase';
    eraseBtn.innerHTML = '🗑️ Erase';
    eraseBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.removeHighlight(highlightId);
      this.closeMenu();
    });

    // Comment button
    const commentBtn = document.createElement('button');
    commentBtn.className = 'text-highlighter-action-button comment';
    commentBtn.innerHTML = '💬 Comment';
    commentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenu();
      this.editNote(highlightId);
    });

    this.menu.appendChild(eraseBtn);
    this.menu.appendChild(commentBtn);

    document.body.appendChild(this.menu);
  }

  async editNote(highlightId) {
    const highlight = this.highlights.find(h => h.id === highlightId);
    if (!highlight) return;

    const note = prompt('Enter note for this highlight:', highlight.note || '');
    if (note !== null) {
      highlight.note = note;
      await StorageManager.updateHighlight(this.currentUrl, highlightId, { note });

      // Update DOM
      const mark = document.querySelector(`[data-highlight-id="${highlightId}"]`);
      if (mark) {
        mark.dataset.note = note;
      }
    }
  }

  async handleKeyDown(e) {
    // Ctrl+Shift+H (Cmd+Shift+H on Mac) - Highlight with last color
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection.toString().trim()) {
        await this.createHighlight(selection, this.lastColor);
      }
    }

    // Ctrl+Shift+U (Cmd+Shift+U on Mac) - Remove highlight
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'U') {
      e.preventDefault();
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const mark = target?.closest('.text-highlighter-mark');
      if (mark) {
        await this.removeHighlight(mark.dataset.highlightId);
      }
    }
  }

  async removeHighlight(highlightId) {
    // Remove from DOM
    const mark = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    }

    // Remove from storage
    await StorageManager.deleteHighlight(this.currentUrl, highlightId);

    // Remove from local array
    this.highlights = this.highlights.filter(h => h.id !== highlightId);
  }

  async handleMessage(request, sendResponse) {
    switch (request.action) {
      case 'getHighlights':
        sendResponse({ highlights: this.highlights });
        break;

      case 'scrollToHighlight':
        this.scrollToHighlight(request.highlightId);
        sendResponse({ success: true });
        break;

      case 'deleteHighlight':
        await this.removeHighlight(request.highlightId);
        sendResponse({ success: true });
        break;

      case 'deleteAllHighlights':
        await this.deleteAllHighlights();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  scrollToHighlight(highlightId) {
    const mark = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Flash effect
      mark.style.transition = 'opacity 0.3s';
      mark.style.opacity = '0.3';
      setTimeout(() => {
        mark.style.opacity = '1';
      }, 300);
    }
  }

  async deleteAllHighlights() {
    // Remove all from DOM
    document.querySelectorAll('.text-highlighter-mark').forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    });

    // Clear storage
    await StorageManager.deleteAllHighlights(this.currentUrl);
    this.highlights = [];
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Initialize highlighter when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TextHighlighter();
  });
} else {
  new TextHighlighter();
}
