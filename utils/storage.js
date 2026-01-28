/**
 * Storage utility for managing highlights
 * Schema: {
 *   highlights: {
 *     [url]: [
 *       {
 *         id: string,
 *         text: string,
 *         color: string,
 *         note: string,
 *         timestamp: number,
 *         anchor: {
 *           xpath: string,
 *           startOffset: number,
 *           endOffset: number,
 *           prefix: string,
 *           suffix: string,
 *           textContent: string
 *         }
 *       }
 *     ]
 *   },
 *   settings: {
 *     lastColor: string,
 *     useSync: boolean
 *   }
 * }
 */

const StorageManager = {
  /**
   * Get storage API based on settings
   */
  async getStorageAPI() {
    const result = await chrome.storage.local.get(['settings']);
    const useSync = result.settings?.useSync || false;
    return useSync ? chrome.storage.sync : chrome.storage.local;
  },

  /**
   * Get all highlights for a specific URL
   */
  async getHighlights(url) {
    const storage = await this.getStorageAPI();
    const result = await storage.get(['highlights']);
    const highlights = result.highlights || {};
    return highlights[url] || [];
  },

  /**
   * Save highlights for a specific URL
   */
  async saveHighlights(url, highlights) {
    const storage = await this.getStorageAPI();
    const result = await storage.get(['highlights']);
    const allHighlights = result.highlights || {};
    allHighlights[url] = highlights;
    await storage.set({ highlights: allHighlights });
  },

  /**
   * Add a new highlight
   */
  async addHighlight(url, highlight) {
    const highlights = await this.getHighlights(url);
    highlights.push(highlight);
    await this.saveHighlights(url, highlights);
  },

  /**
   * Update an existing highlight
   */
  async updateHighlight(url, highlightId, updates) {
    const highlights = await this.getHighlights(url);
    const index = highlights.findIndex(h => h.id === highlightId);
    if (index !== -1) {
      highlights[index] = { ...highlights[index], ...updates };
      await this.saveHighlights(url, highlights);
    }
  },

  /**
   * Delete a highlight
   */
  async deleteHighlight(url, highlightId) {
    const highlights = await this.getHighlights(url);
    const filtered = highlights.filter(h => h.id !== highlightId);
    await this.saveHighlights(url, filtered);
  },

  /**
   * Delete all highlights for a URL
   */
  async deleteAllHighlights(url) {
    await this.saveHighlights(url, []);
  },

  /**
   * Get all highlights across all URLs
   */
  async getAllHighlights() {
    const storage = await this.getStorageAPI();
    const result = await storage.get(['highlights']);
    return result.highlights || {};
  },

  /**
   * Export all data as JSON
   */
  async exportData() {
    const storage = await this.getStorageAPI();
    const data = await storage.get(null);
    return JSON.stringify(data, null, 2);
  },

  /**
   * Import data from JSON
   */
  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      const storage = await this.getStorageAPI();
      await storage.set(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get settings
   */
  async getSettings() {
    const storage = chrome.storage.local; // Always use local for settings
    const result = await storage.get(['settings']);
    return result.settings || { lastColor: 'yellow', useSync: false };
  },

  /**
   * Update settings
   */
  async updateSettings(updates) {
    const storage = chrome.storage.local;
    const settings = await this.getSettings();
    const newSettings = { ...settings, ...updates };
    await storage.set({ settings: newSettings });
  },

  /**
   * Search highlights by text or note
   */
  async searchHighlights(query) {
    const allHighlights = await this.getAllHighlights();
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [url, highlights] of Object.entries(allHighlights)) {
      for (const highlight of highlights) {
        if (
          highlight.text.toLowerCase().includes(lowerQuery) ||
          (highlight.note && highlight.note.toLowerCase().includes(lowerQuery))
        ) {
          results.push({ ...highlight, url });
        }
      }
    }

    return results;
  },

  /**
   * Share highlights for a URL to the backend
   */
  async shareHighlights(url) {
    const highlights = await this.getHighlights(url);
    if (highlights.length === 0) return null;

    try {
      const response = await fetch('https://highlighter-phi.vercel.app/api/highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, highlights }),
      });

      if (!response.ok) throw new Error('Failed to share');
      const data = await response.json();
      return data.id; // Return the share ID
    } catch (error) {
      console.error('Error sharing highlights:', error);
      return null;
    }
  },

  /**
   * Fetch shared highlights from the backend
   */
  async fetchSharedHighlights(shareId) {
    try {
      const response = await fetch(`https://highlighter-phi.vercel.app/api/highlights/${shareId}`);
      if (!response.ok) throw new Error('Failed to fetch shared highlights');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching shared highlights:', error);
      return null;
    }
  }
};

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
