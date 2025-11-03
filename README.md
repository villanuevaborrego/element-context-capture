# Element Context Capture MCP Server

<div align="center">

**Browser element inspection for Claude** - Capture HTML elements with full context (structure, styles, screenshots) directly from your browser into Claude conversations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-blue)](https://modelcontextprotocol.io)

</div>

## What is this?

An MCP (Model Context Protocol) server that brings Cursor-like browser integration to Claude Code. Eliminate frontend communication ambiguity by capturing elements visually:

- 🎯 **Right-click any element** → Instantly available in Claude
- 📸 **Full context captured**: HTML, computed styles, screenshots, positioning
- 🔍 **Chrome DevTools-style inspector**: Hover to see element details with visual overlay
- 🚀 **Zero configuration**: Works across all projects once installed

## Quick Start

### Installation

Add to your Claude Desktop configuration:

```bash
# Using npx (recommended)
npx @jvillanueva/element-context-capture
```

Or manually edit your Claude configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "element-context-capture": {
      "command": "npx",
      "args": [
        "-y",
        "github:jvillanueva/element-context-capture#main"
      ]
    }
  }
}
```

### Chrome Extension

1. Download/clone this repository
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" → Select the `chrome-extension` folder
5. Extension icon appears in toolbar

### Restart Claude

Close and reopen Claude Desktop/Code for the MCP server to initialize.

## Usage

### Capture Elements

**Method 1: Context Menu** (Recommended)
- Right-click any element → "Add to Claude Context"

**Method 2: Inspector Mode**
- Press `Alt+Shift+C` or click extension icon
- Hover over elements (visual overlay appears with element info)
- Click to capture
- Press `ESC` to exit

### In Claude Conversations

```
You: Show me the captured elements

Claude: [Uses list_captured_elements() tool]
- #submit-button (https://example.com)
- .nav-menu (https://example.com)

You: Analyze the submit button styling

Claude: [Uses get_element_details() to see full context]
Looking at the captured button element:
- Background: #4A90E2
- Padding: 12px 24px
- Border-radius: 4px
[Provides specific recommendations based on actual styles]
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
│  Claude Desktop │
│   / Claude Code │
└─────────────────┘
```

- **Chrome Extension**: Captures elements and sends via WebSocket
- **MCP Server**: Stores elements (in-memory, 1hr TTL), exposes MCP tools/resources
- **Claude**: Accesses elements through MCP protocol across all projects

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

1. Restart Claude Desktop/Code (this starts the MCP server)
2. Check extension popup for error messages
3. Verify no firewall blocking port 38100
4. Check if another instance is using the port

### Elements not appearing in Claude

1. Use `get_server_status()` tool to check connection
2. Capture a test element and use `list_captured_elements()`
3. Check Claude Desktop logs for MCP server errors
4. Verify extension shows "Connected" status

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
git clone https://github.com/jvillanueva/element-context-capture.git
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

## Related Projects

- [Chrome DevTools MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/chrome-devtools) - Browser automation via DevTools Protocol
- [Serena](https://github.com/oraios/serena) - Semantic code intelligence MCP
- [Sequential Thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking) - Extended reasoning MCP

## Acknowledgments

Inspired by [Cursor](https://cursor.sh/) v2's browser integration feature.

---

<div align="center">

**Made for Claude Code** - Bringing visual browser inspection to AI-assisted development 🎯

[Report Bug](https://github.com/jvillanueva/element-context-capture/issues) · [Request Feature](https://github.com/jvillanueva/element-context-capture/issues)

</div>
