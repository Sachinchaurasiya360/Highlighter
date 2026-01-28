# Text Highlighter Pro - Chrome Extension

A production-ready Chrome Extension (Manifest V3) that lets users highlight text on any webpage with different colors. Highlights persist across sessions and survive page refreshes.

## ✨ Features

### Core Features
- **Text Highlighting**: Select text and choose from 5 colors (Yellow, Green, Pink, Blue, Purple)
- **Persistent Storage**: Highlights automatically save and restore on page revisit
- **Robust Anchoring**: Uses XPath + text context to survive DOM changes
- **Context Menu**: Right-click selected text to highlight
- **Keyboard Shortcuts**: Quick highlight (Ctrl+Shift+H) and remove (Ctrl+Shift+U)

### Advanced Features
- **Notes/Comments**: Add notes to any highlight (click highlight to edit)
- **Tooltip Display**: Hover over highlights to see attached notes
- **Search & Filter**: Search by text/note content, filter by color
- **Export/Import**: Backup and restore all highlights as JSON
- **Chrome Sync**: Optional sync across all your Chrome browsers
- **Scroll to Highlight**: Click highlights in popup to jump to them on page
- **Collaborative Sharing**: Share your highlights via a unique short link!

## 📁 Project Structure

```
Highlight/
├── manifest.json                 # Extension configuration
├── background/
│   └── service-worker.js        # Context menu & keyboard commands
├── content-script/
│   ├── highlighter.js           # Main highlighting logic
│   └── highlighter.css          # Highlight styles
├── popup/
│   ├── popup.html               # Extension popup UI
│   ├── popup.css                # Popup styles
│   └── popup.js                 # Popup logic
├── utils/
│   └── storage.js               # Storage management
└── icons/
    ├── icon16.svg               # 16x16 icon
    ├── icon48.svg               # 48x48 icon
    └── icon128.svg              # 128x128 icon
```

## 🚀 Installation & Testing

### Method 1: Load Unpacked Extension (Development)

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `Highlight` folder
   - Extension should now appear in your toolbar

### Method 2: Package as CRX (Production)

1. On `chrome://extensions/`, click "Pack extension"
2. Select the `Highlight` folder
3. Click "Pack Extension"
4. Share the generated `.crx` file

## 📖 How to Use

### Highlighting Text

**Method 1: Color Menu (Mouse)**
1. Select any text on a webpage
2. A color palette appears below your selection
3. Click a color to highlight

**Method 2: Context Menu (Right-click)**
1. Select text
2. Right-click → "Highlight" → Choose color

**Method 3: Keyboard Shortcut**
1. Select text
2. Press `Ctrl+Shift+H` (Mac: `Cmd+Shift+H`)
3. Highlights with your last-used color

### Managing Highlights

**View Highlights**
- Click the extension icon in toolbar
- See all highlights on current page

**Erase or Add Notes**
- Click any highlight on the page
- A menu appears with two options:
  - **🗑️ Erase**: Remove the highlight completely
  - **💬 Comment**: Add or edit a note for the highlight
- Hover over highlight to see the note tooltip

**Delete Highlights**
- **Single**: Click highlight → "Erase", or use trash icon in popup
- **All on page**: Click "Delete All" button in popup
- **Remove with keyboard**: Hover over highlight, press `Ctrl+Shift+U`

### 🔗 Sharing Highlights (Collaborative)

**Share your highlights**
1. Click the extension icon.
2. Click the green **"Share This Page"** button.
3. A link like `https://highlighter-phi.vercel.app/h/ABC123XYZ` is copied to your clipboard.
4. Send this to a friend!

**View shared highlights**
- When someone opens your shared link, the extension automatically downloads and applies the highlights to the page.

## 🔧 Technical Details

### Backend & Storage
- **Production URL**: `https://highlighter-phi.vercel.app`
- **Database**: MongoDB (Persistent highlights)
- **Auto-Expiry**: Shared links expire after 30 days.

### Highlight Anchoring Strategy
The extension uses a multi-layer anchoring approach:
1. **XPath**: Stores the DOM path to the element
2. **Text Offsets**: Character positions within the text node
3. **Context Matching**: 50 characters before/after for verification

## 📄 License
This extension is provided as-is for educational and personal use.

---

**Version**: 1.0.0  
**Manifest Version**: 3  
**Minimum Chrome Version**: 88+
