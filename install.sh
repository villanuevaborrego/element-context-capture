#!/bin/bash
set -e

echo "🔧 Element Context Capture - Installation Script"
echo "================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the absolute path to this directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MCP_SERVER_PATH="$SCRIPT_DIR/mcp-server/src/index.js"

echo "📂 Project directory: $SCRIPT_DIR"
echo ""

# Check Node.js installation
echo "1️⃣  Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"
echo ""

# Install MCP server dependencies
echo "2️⃣  Installing MCP server dependencies..."
cd "$SCRIPT_DIR/mcp-server"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi
echo ""

# Detect OS and set config path
echo "3️⃣  Configuring global MCP server..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_DIR="$HOME/.config/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
else
    # Windows (Git Bash / WSL)
    CONFIG_DIR="$APPDATA/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
fi

echo "Config location: $CONFIG_FILE"

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Check if config file exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  Existing config file found${NC}"

    # Check if element-context-capture is already configured
    if grep -q "element-context-capture" "$CONFIG_FILE"; then
        echo -e "${YELLOW}⚠️  element-context-capture already configured${NC}"
        read -p "Do you want to update it? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping MCP configuration update"
            SKIP_MCP_CONFIG=true
        fi
    fi

    if [ -z "$SKIP_MCP_CONFIG" ]; then
        # Backup existing config
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
        echo -e "${GREEN}✅ Backed up existing config to $CONFIG_FILE.backup${NC}"

        # Use jq to merge if available, otherwise manual merge
        if command -v jq &> /dev/null; then
            # Create temporary config with our server
            cat > /tmp/mcp_addon.json << EOF
{
  "mcpServers": {
    "element-context-capture": {
      "command": "node",
      "args": ["$MCP_SERVER_PATH"]
    }
  }
}
EOF
            # Merge configs
            jq -s '.[0] * .[1]' "$CONFIG_FILE" /tmp/mcp_addon.json > /tmp/merged_config.json
            mv /tmp/merged_config.json "$CONFIG_FILE"
            rm /tmp/mcp_addon.json
            echo -e "${GREEN}✅ Merged with existing configuration${NC}"
        else
            echo -e "${YELLOW}⚠️  jq not found. Please manually add this to your $CONFIG_FILE:${NC}"
            echo ""
            echo '  "element-context-capture": {'
            echo '    "command": "node",'
            echo "    \"args\": [\"$MCP_SERVER_PATH\"]"
            echo '  }'
        fi
    fi
else
    # Create new config file
    cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "element-context-capture": {
      "command": "node",
      "args": ["$MCP_SERVER_PATH"]
    }
  }
}
EOF
    echo -e "${GREEN}✅ Created new config file${NC}"
fi
echo ""

# Print Chrome extension installation instructions
echo "4️⃣  Chrome Extension Installation"
echo "=================================="
echo ""
echo "To install the Chrome extension:"
echo ""
echo "1. Open Chrome and navigate to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top-right)"
echo "3. Click 'Load unpacked'"
echo "4. Select this directory:"
echo "   $SCRIPT_DIR/chrome-extension"
echo ""
echo "The extension icon should appear in your Chrome toolbar."
echo ""

# Print final instructions
echo "✨ Installation Complete!"
echo "========================"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Restart Claude Code / Claude Desktop to load the MCP server"
echo "2. Install the Chrome extension (see instructions above)"
echo "3. Start using Element Context Capture!"
echo ""
echo "Usage:"
echo "  • In Chrome: Use Alt+Shift+C to enable inspection mode"
echo "  • Or right-click any element and select 'Add to Claude Context'"
echo "  • In Claude Code: Use MCP tools to access captured elements"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "The MCP server must be running for the Chrome extension to work."
echo "It will start automatically when Claude Code/Desktop launches."
echo ""
