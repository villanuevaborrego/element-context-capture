#!/usr/bin/env node

/**
 * Element Context Capture MCP Server
 * Main entry point
 */

import { ElementStorage } from './storage.js'
import { ExtensionWebSocketServer } from './websocket-server.js'
import { ElementContextMCPServer } from './mcp-server.js'

// Configuration
const CONFIG = {
    storage: {
        maxElements: 50,
        ttl: 3600000, // 1 hour
        cleanupInterval: 300000 // 5 minutes
    },
    websocket: {
        port: 38100
    }
}

export async function main() {
    console.error('='.repeat(60))
    console.error('Element Context Capture MCP Server v1.0.0')
    console.error('='.repeat(60))

    try {
        // Initialize storage
        console.error('Initializing element storage...')
        const storage = new ElementStorage(CONFIG.storage)
        console.error(`  Max elements: ${CONFIG.storage.maxElements}`)
        console.error(`  TTL: ${CONFIG.storage.ttl / 1000}s`)

        // Start WebSocket server for extension communication
        console.error('Starting WebSocket server for Chrome extension...')
        const wsServer = new ExtensionWebSocketServer(storage, CONFIG.websocket)
        const actualPort = await wsServer.start()
        console.error(`  Listening on: ws://localhost:${actualPort}`)

        // Start MCP server
        console.error('Starting MCP server...')
        const mcpServer = new ElementContextMCPServer(storage, wsServer)
        await mcpServer.start()

        console.error('='.repeat(60))
        console.error('Server ready!')
        console.error('  Chrome extension should connect to: ws://localhost:' + actualPort)
        console.error('  Claude Code can now use MCP tools and resources')
        console.error('='.repeat(60))

        // Graceful shutdown
        const cleanup = async () => {
            console.error('\nShutting down gracefully...')
            wsServer.stop()
            storage.destroy()
            await mcpServer.stop()
            process.exit(0)
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        // Keep process alive
        process.stdin.resume()

    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}

// Only run if this is the main module
// Use realpath to resolve symlinks (e.g., /tmp -> /private/tmp on macOS)
import { realpath } from 'fs/promises'
const scriptPath = await realpath(process.argv[1])
if (import.meta.url === `file://${scriptPath}`) {
    main()
}
