/**
 * Popup script for managing highlights UI
 */

class PopupManager {
  constructor() {
    this.currentUrl = '';
    this.currentHighlights = [];
    this.allHighlights = {};
    this.activeFilter = 'all';
    this.searchQuery = '';
    
    this.init();
  }

  async init() {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentUrl = this.normalizeUrl(tab.url);

    // Load data
    await this.loadData();

    // Setup event listeners
    this.setupEventListeners();

    // Render initial view
    this.renderCurrentHighlights();
    this.renderAllHighlights();
    this.loadSettings();
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  async loadData() {
    // Load current page highlights
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getHighlights' });
      this.currentHighlights = response.highlights || [];
    } catch (error) {
      console.error('Error loading highlights:', error);
      this.currentHighlights = [];
    }

    // Load all highlights
    this.allHighlights = await this.getAllHighlights();

    // Update count
    document.getElementById('highlight-count').textContent = 
      `${this.currentHighlights.length} highlight${this.currentHighlights.length !== 1 ? 's' : ''}`;
  }

  async getAllHighlights() {
    const result = await chrome.storage.local.get(['highlights', 'settings']);
    const useSync = result.settings?.useSync || false;
    
    if (useSync) {
      const syncResult = await chrome.storage.sync.get(['highlights']);
      return syncResult.highlights || {};
    }
    
    return result.highlights || {};
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => this.switchTab(button.dataset.tab));
    });

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderCurrentHighlights();
    });

    document.getElementById('search-all-input').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderAllHighlights();
    });

    // Color filters
    document.querySelectorAll('.color-filter').forEach(button => {
      button.addEventListener('click', () => {
        this.activeFilter = button.dataset.color;
        document.querySelectorAll('.color-filter').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        this.renderCurrentHighlights();
      });
    });

    // Delete all
    document.getElementById('delete-all-btn').addEventListener('click', () => {
      this.deleteAllHighlights();
    });

    // Share button
    document.getElementById('share-btn').addEventListener('click', () => {
      this.handleShare();
    });

    // Export/Import
    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // Settings
    document.getElementById('use-sync-checkbox').addEventListener('change', (e) => {
      this.updateSyncSetting(e.target.checked);
    });
  }

  switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // Reset search when switching tabs
    this.searchQuery = '';
    document.getElementById('search-input').value = '';
    document.getElementById('search-all-input').value = '';

    // Reload data for the tab
    if (tabName === 'current') {
      this.renderCurrentHighlights();
    } else if (tabName === 'all') {
      this.renderAllHighlights();
    }
  }

  renderCurrentHighlights() {
    const container = document.getElementById('highlights-list');
    
    // Filter highlights
    let filtered = this.currentHighlights;

    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(h => h.color === this.activeFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(h => 
        h.text.toLowerCase().includes(this.searchQuery) ||
        (h.note && h.note.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No highlights found.</div>';
      return;
    }

    container.innerHTML = filtered.map(highlight => `
      <div class="highlight-item ${highlight.color}" data-id="${highlight.id}">
        <div class="highlight-text">${this.escapeHtml(highlight.text)}</div>
        ${highlight.note ? `<div class="highlight-note">📝 ${this.escapeHtml(highlight.note)}</div>` : ''}
        <div class="highlight-meta">
          <span>${this.formatDate(highlight.timestamp)}</span>
          <div class="highlight-actions">
            <button class="icon-btn delete" data-action="delete" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');

    // Add click listeners
    container.querySelectorAll('.highlight-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.icon-btn')) {
          this.scrollToHighlight(item.dataset.id);
        }
      });

      const deleteBtn = item.querySelector('[data-action="delete"]');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteHighlight(item.dataset.id);
      });
    });
  }

  renderAllHighlights() {
    const container = document.getElementById('all-highlights-list');
    
    // Flatten all highlights
    const allItems = [];
    for (const [url, highlights] of Object.entries(this.allHighlights)) {
      for (const highlight of highlights) {
        allItems.push({ ...highlight, url });
      }
    }

    // Filter by search
    let filtered = allItems;
    if (this.searchQuery) {
      filtered = filtered.filter(h => 
        h.text.toLowerCase().includes(this.searchQuery) ||
        (h.note && h.note.toLowerCase().includes(this.searchQuery)) ||
        h.url.toLowerCase().includes(this.searchQuery)
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No highlights found.</div>';
      return;
    }

    container.innerHTML = filtered.map(highlight => `
      <div class="highlight-item ${highlight.color}">
        <div class="highlight-text">${this.escapeHtml(highlight.text)}</div>
        ${highlight.note ? `<div class="highlight-note">📝 ${this.escapeHtml(highlight.note)}</div>` : ''}
        <div class="highlight-meta">
          <span class="highlight-url" title="${this.escapeHtml(highlight.url)}">${this.getUrlDomain(highlight.url)}</span>
          <span>${this.formatDate(highlight.timestamp)}</span>
        </div>
      </div>
    `).join('');
  }

  async scrollToHighlight(highlightId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'scrollToHighlight',
        highlightId: highlightId
      });
      window.close();
    } catch (error) {
      console.error('Error scrolling to highlight:', error);
    }
  }

  async deleteHighlight(highlightId) {
    if (!confirm('Delete this highlight?')) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'deleteHighlight',
        highlightId: highlightId
      });

      // Reload data
      await this.loadData();
      this.renderCurrentHighlights();
    } catch (error) {
      console.error('Error deleting highlight:', error);
    }
  }

  async deleteAllHighlights() {
    if (!confirm('Delete all highlights on this page?')) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'deleteAllHighlights'
      });

      // Reload data
      await this.loadData();
      this.renderCurrentHighlights();
    } catch (error) {
      console.error('Error deleting highlights:', error);
    }
  }

  async handleShare() {
    if (this.currentHighlights.length === 0) {
      alert('Highlighter: No highlights to share on this page!');
      return;
    }

    const shareBtn = document.getElementById('share-btn');
    const originalText = shareBtn.textContent;
    shareBtn.textContent = 'Sharing...';
    shareBtn.disabled = true;

    try {
      // Import StorageManager since we need to communicate with backend
      // In popup context, we can use the backend directly or via StorageManager if it's available
      // Note: StorageManager is available in content-scripts, let's ensure it's here too or call it via chrome.runtime
      
      const shareId = await this.shareWithBackend(this.currentUrl);
      
      if (shareId) {
        const shareLink = `http://localhost:3000/h/${shareId}`;
        await navigator.clipboard.writeText(shareLink);
        
        shareBtn.textContent = 'Link Copied!';
        shareBtn.style.background = '#2196f3';
        
        setTimeout(() => {
          shareBtn.textContent = originalText;
          shareBtn.style.background = '#4caf50';
          shareBtn.disabled = false;
        }, 3000);
      } else {
        throw new Error('No share ID returned');
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      alert('Failed to share highlights. Is the backend server running?');
      shareBtn.textContent = originalText;
      shareBtn.disabled = false;
    }
  }

  async shareWithBackend(url) {
    // In popup, we might need a separate way to share or reuse StorageManager logic
    // Let's implement it directly here to be safe and simple
    try {
      const response = await fetch('http://localhost:3000/api/highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, highlights: this.currentHighlights }),
      });

      if (!response.ok) throw new Error('Failed to share');
      const data = await response.json();
      return data.id;
    } catch (error) {
      return null;
    }
  }

  async exportData() {
    try {
      const storage = await chrome.storage.local.get(['settings']);
      const useSync = storage.settings?.useSync || false;
      const storageAPI = useSync ? chrome.storage.sync : chrome.storage.local;
      
      const data = await storageAPI.get(null);
      const json = JSON.stringify(data, null, 2);
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `highlights-export-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting data: ' + error.message);
    }
  }

  async importData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const storage = await chrome.storage.local.get(['settings']);
      const useSync = storage.settings?.useSync || false;
      const storageAPI = useSync ? chrome.storage.sync : chrome.storage.local;
      
      await storageAPI.set(data);
      
      alert('Data imported successfully!');
      
      // Reload
      await this.loadData();
      this.renderCurrentHighlights();
      this.renderAllHighlights();
    } catch (error) {
      alert('Error importing data: ' + error.message);
    }
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};
    
    document.getElementById('use-sync-checkbox').checked = settings.useSync || false;
  }

  async updateSyncSetting(useSync) {
    await chrome.storage.local.set({
      settings: { useSync }
    });

    if (useSync) {
      // Copy data to sync storage
      const localData = await chrome.storage.local.get(['highlights']);
      await chrome.storage.sync.set(localData);
    }

    alert(`Storage ${useSync ? 'sync enabled' : 'sync disabled'}. Your highlights will ${useSync ? 'now sync' : 'stay local'}.`);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  }

  getUrlDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
