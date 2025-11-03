# Element Context Capture MCP Server

<div align="center">

**Browser element inspection for Claude** - Capture HTML elements with full context (structure, styles, screenshots) directly from your browser into Claude conversations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-blue)](https://modelcontextprotocol.io)

</div>

## What is this?

An MCP (Model Context Protocol) server that brings visual browser integration to Claude Code (CLI). Eliminate frontend communication ambiguity by capturing elements visually:

- 🎯 **Right-click any element** → Instantly available in Claude Code
- 📸 **Full context captured**: HTML, computed styles, screenshots, positioning
- 🔍 **Chrome DevTools-style inspector**: Hover to see element details with visual overlay
- 🚀 **Zero configuration**: Works across all projects once installed
- 🔧 **Made for Claude Code CLI**: Optimized for the command-line Claude experience

## Quick Start

### Installation

**Step 1: Add MCP Server to Claude Code**

Edit your Claude MCP configuration file:

**macOS/Linux**: `~/.config/claude-code/mcp.json`
**Windows**: `%APPDATA%\claude-code\mcp.json`

If the file doesn't exist, create it. Add this configuration:

```json
{
  "mcpServers": {
    "element-context-capture": {
      "command": "npx",
      "args": [
        "-y",
        "github:villanuevaborrego/element-context-capture#main"
      ]
    }
  }
}
```

**Alternative**: If you also use Claude Desktop, use the same configuration in:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Step 2: Install Chrome Extension**

1. Clone/download this repository:
   ```bash
   git clone https://github.com/villanuevaborrego/element-context-capture.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right corner)
4. Click **Load unpacked**
5. Select the `chrome-extension` folder from the cloned repository
6. The extension icon should appear in your toolbar

**Step 3: Restart Claude Code**

Restart your Claude Code session for the MCP server to initialize:
```bash
# Exit your current Claude session and start a new one
claude
```

You can verify the MCP is running by asking Claude:
```
You: Is the element-context-capture MCP working?
Claude: [Uses get_server_status() to check]
```

## Usage

### Capture Elements

**Method 1: Context Menu** (Recommended)
- Right-click any element → "Add to Claude Context"

**Method 2: Inspector Mode**
- Press `Alt+Shift+C` or click extension icon
- Hover over elements (visual overlay appears with element info)
- Click to capture
- Press `ESC` to exit

### In Claude Code Sessions

```
You: Show me the captured elements

Claude: [Uses mcp__element-context-capture__list_captured_elements()]
Found 2 captured elements:
- #submit-button from https://example.com
- .nav-menu from https://example.com

You: Analyze the submit button styling

Claude: [Uses mcp__element-context-capture__get_element_details()]
Looking at the captured button element:
- Selector: #submit-button
- Background: #4A90E2
- Padding: 12px 24px
- Border-radius: 4px
- Font size: 16px
- [Shows screenshot of the button]

I can see this is a primary CTA button. Here are my recommendations...
```

## Features

### Visual Inspector
- **Chrome DevTools-style element highlighter**
- **Real-time tooltip** showing:
  - Tag, ID, classes with syntax highlighting
  - Dimensions (width × height)
  - Color swatches for background/text colors
- **Box model visualization** (margin, padding, content layers)

### Captured Data

Each element includes:
- **Selector**: Unique CSS selector
- **HTML**: Complete outer HTML (sanitized)
- **Styles**: All computed CSS properties
- **Screenshot**: Visual capture
- **Position**: Absolute coordinates and dimensions
- **Context**: Parent, siblings, children count
- **Metadata**: URL, timestamp

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_captured_elements()` | List all captured elements |
| `get_element_details(id)` | Get full element context |
| `search_elements(query)` | Search by selector/text/URL |
| `remove_element(id)` | Remove specific element |
| `clear_all_elements()` | Clear all elements |
| `get_storage_stats()` | Get storage info |
| `get_server_status()` | Check WebSocket connection status |

### MCP Resources

| Resource | Description |
|----------|-------------|
| `element://list` | All captured elements (JSON) |
| `element://<id>` | Specific element details |
| `element://<id>/screenshot` | Element screenshot (PNG) |

## Architecture

```
┌─────────────────┐
│ Chrome Browser  │
│   + Extension   │
└────────┬────────┘
         │ WebSocket (port 38100)
         ▼
┌─────────────────┐
│   MCP Server    │
│   (Node.js)     │
└────────┬────────┘
         │ stdio (MCP Protocol)
         ▼
┌─────────────────┐
│  Claude Code    │
│     (CLI)       │
└─────────────────┘
```

- **Chrome Extension**: Captures elements and sends via WebSocket
- **MCP Server**: Stores elements (in-memory, 1hr TTL), exposes MCP tools/resources
- **Claude Code**: Accesses elements through MCP protocol across all projects and sessions

## Configuration

### Storage Limits

Default settings (edit `mcp-server/src/index.js`):

```javascript
const CONFIG = {
    storage: {
        maxElements: 50,        // Max elements stored
        ttl: 3600000,          // Element lifetime (1 hour)
        cleanupInterval: 300000 // Cleanup frequency (5 min)
    }
}
```

### WebSocket Port

Default: `38100` (automatically tries 38101-38103 if port busy)

Edit `chrome-extension/background/service-worker.js`:
```javascript
const WS_SERVER_URL = 'ws://localhost:38100'
```

## Security

- ✅ HTML sanitization (removes scripts, event handlers)
- ✅ Sensitive attribute redaction (passwords, tokens)
- ✅ Size limits (HTML: 50KB, text: 10KB, screenshot: 1MB)
- ✅ Auto-expiry (1 hour TTL)
- ✅ FIFO storage (max 50 elements)

## Troubleshooting

### Extension shows "Disconnected"

1. Restart your Claude Code session (this starts the MCP server)
2. Check extension popup for error messages
3. Verify no firewall is blocking port 38100
4. Check if another instance is using the port

### Elements not appearing in Claude Code

1. Ask Claude: "Is the element-context-capture MCP working?"
2. Capture a test element and ask: "Show me captured elements"
3. Check the extension shows "Connected" status
4. Verify the MCP configuration in `~/.config/claude-code/mcp.json`

### Selector not unique

Extension tries multiple selector strategies:
1. ID attribute (if unique)
2. Class combinations
3. Data attributes
4. nth-child with parent context
5. Full document path (fallback)

## Development

```bash
# Clone repository
git clone https://github.com/villanuevaborrego/element-context-capture.git
cd element-context-capture

# Install dependencies
cd mcp-server && npm install

# Run in development mode (auto-reload)
npm run dev

# Test MCP interface with inspector
npx @modelcontextprotocol/inspector node src/index.js

# Debug Chrome extension
# 1. Open chrome://extensions/
# 2. Click "Inspect views: service worker" (background)
# 3. Right-click popup → "Inspect" (popup UI)
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file

---

<div align="center">

**Made for Claude Code** - Bringing visual browser inspection to AI-assisted development 🎯

[Report Bug](https://github.com/villanuevaborrego/element-context-capture/issues) · [Request Feature](https://github.com/villanuevaborrego/element-context-capture/issues)

</div>
