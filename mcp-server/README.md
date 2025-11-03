# Element Context Capture MCP Server

MCP server that receives captured HTML element data from a Chrome extension and exposes it to Claude Code via the Model Context Protocol.

## Architecture

```
Chrome Extension → WebSocket (port 38100) → MCP Server → Claude Code (stdio)
```

## Features

- **WebSocket Server**: Receives element captures from Chrome extension
- **Element Storage**: In-memory storage with TTL (1 hour default)
- **MCP Protocol**: Exposes resources and tools to Claude Code
- **Auto-cleanup**: Removes expired elements automatically
- **Size Limits**: Prevents memory bloat (50 elements max, configurable)
- **Security**: Sanitizes HTML, redacts sensitive attributes

## Installation

```bash
cd mcp-server
npm install
```

## Usage

### Start Server

```bash
npm start
```

The server will:
1. Start WebSocket server on port 38100 (with fallback to 38101-38103)
2. Start MCP server on stdio for Claude Code communication
3. Log status to stderr (stdout is reserved for MCP protocol)

### Configure with Claude Code

Add to your Claude Code MCP settings (`~/.claude/config.json` or project-level):

```json
{
  "mcpServers": {
    "element-context-capture": {
      "command": "node",
      "args": ["/path/to/element-context-capture/mcp-server/src/index.js"]
    }
  }
}
```

Or use npm global install:

```bash
npm install -g .
```

Then configure:

```json
{
  "mcpServers": {
    "element-context-capture": {
      "command": "element-context-capture"
    }
  }
}
```

## MCP Resources

Resources that Claude can read:

- `element://list` - List all captured elements (summary view)
- `element://<id>` - Full details for specific element
- `element://<id>/screenshot` - Element screenshot (if available)

## MCP Tools

Tools that Claude can call:

### `list_captured_elements()`
Returns array of all captured elements with summary info.

### `get_element_details(id: string)`
Returns full details for a specific element including HTML, styles, screenshot, etc.

### `search_elements(query: string)`
Search captured elements by selector, text content, or URL.

### `remove_element(id: string)`
Remove a specific element from storage.

### `clear_all_elements()`
Clear all captured elements.

### `get_storage_stats()`
Get storage statistics (count, TTL, timestamps).

### `get_server_status()`
Get WebSocket server status and connection info.

## WebSocket Protocol

The Chrome extension communicates via WebSocket with JSON messages:

### Extension → Server

**Element Captured:**
```json
{
  "type": "ELEMENT_CAPTURED",
  "element": {
    "id": "uuid-here",
    "timestamp": 1699999999999,
    "url": "https://example.com",
    "selector": "#submit-button",
    "html": "<button id=\"submit-button\">Submit</button>",
    "text": "Submit",
    "attributes": {"id": "submit-button", "class": "btn btn-primary"},
    "computed": {"display": "block", "width": "100px", ...},
    "bounds": {"x": 100, "y": 200, "width": 100, "height": 40},
    "screenshot": "base64-encoded-webp",
    "context": {"parent": "form#login", "siblings": 2, "children": 0}
  }
}
```

**Ping:**
```json
{
  "type": "PING"
}
```

### Server → Extension

**Welcome:**
```json
{
  "type": "WELCOME",
  "data": {
    "serverVersion": "1.0.0",
    "maxElements": 50,
    "ttl": 3600000
  }
}
```

**Element Stored:**
```json
{
  "type": "ELEMENT_STORED",
  "data": {
    "id": "uuid-here",
    "selector": "#submit-button",
    "timestamp": 1699999999999
  }
}
```

**Error:**
```json
{
  "type": "ERROR",
  "error": "Error message here"
}
```

## Configuration

Edit `src/index.js` to modify:

```javascript
const CONFIG = {
    storage: {
        maxElements: 50,        // Max elements to store
        ttl: 3600000,          // Element lifetime (ms)
        cleanupInterval: 300000 // Cleanup frequency (ms)
    },
    websocket: {
        port: 38100            // WebSocket port
    }
}
```

## Security Features

1. **HTML Sanitization**: Removes `<script>` tags and event handlers
2. **Attribute Redaction**: Redacts sensitive attributes (password, token, secret, etc.)
3. **Size Limits**:
   - HTML: 50KB max
   - Text: 10KB max
   - Screenshot: 1MB max
4. **Auto-expiry**: Elements expire after TTL (1 hour default)

## Development

### Run with auto-reload:
```bash
npm run dev
```

### Run tests:
```bash
npm test
```

## Troubleshooting

### Port already in use
The server will automatically try fallback ports (38101-38103). Check logs for actual port used.

### WebSocket connection fails
Ensure firewall allows localhost connections on port 38100.

### Elements not appearing in Claude
1. Check WebSocket server status: Use `get_server_status()` tool
2. Check storage: Use `list_captured_elements()` tool
3. Check logs (stderr output)

## License

MIT
