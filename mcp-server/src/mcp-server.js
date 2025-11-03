/**
 * MCP Server implementation for Element Context Capture
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { summarizeElement } from './schema.js'

export class ElementContextMCPServer {
    constructor(storage, wsServer) {
        this.storage = storage
        this.wsServer = wsServer
        this.server = new Server(
            {
                name: 'element-context-capture',
                version: '1.0.0'
            },
            {
                capabilities: {
                    resources: {},
                    tools: {}
                }
            }
        )

        this.setupHandlers()
    }

    /**
     * Setup MCP request handlers
     */
    setupHandlers() {
        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            const elements = this.storage.getAll()
            const resources = []

            // Add list resource
            resources.push({
                uri: 'element://list',
                name: 'Captured Elements List',
                description: `List of ${elements.length} captured elements`,
                mimeType: 'application/json'
            })

            // Add individual element resources
            for (const element of elements) {
                resources.push({
                    uri: `element://${element.id}`,
                    name: `Element: ${element.selector}`,
                    description: `Captured from ${new URL(element.url).hostname}`,
                    mimeType: 'application/json'
                })

                // Add screenshot resource if available
                if (element.screenshot) {
                    resources.push({
                        uri: `element://${element.id}/screenshot`,
                        name: `Screenshot: ${element.selector}`,
                        description: `Visual capture of ${element.selector}`,
                        mimeType: 'image/png'
                    })
                }
            }

            return { resources }
        })

        // Read a resource
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const uri = request.params.uri

            if (uri === 'element://list') {
                // Return list of all elements (summarized)
                const elements = this.storage.getAll()
                const summaries = elements.map(summarizeElement)
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(summaries, null, 2)
                    }]
                }
            }

            // Parse element ID from URI
            const match = uri.match(/^element:\/\/([^/]+)(?:\/(.+))?$/)
            if (!match) {
                throw new Error(`Invalid resource URI: ${uri}`)
            }

            const [, elementId, subResource] = match
            const element = this.storage.get(elementId)

            if (!element) {
                throw new Error(`Element not found: ${elementId}`)
            }

            if (subResource === 'screenshot') {
                // Return screenshot
                if (!element.screenshot) {
                    throw new Error(`No screenshot available for element: ${elementId}`)
                }

                return {
                    contents: [{
                        uri,
                        mimeType: 'image/png',
                        blob: element.screenshot // Base64 encoded
                    }]
                }
            }

            // Return full element details
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(element, null, 2)
                }]
            }
        })

        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'list_captured_elements',
                        description: 'List all captured elements with summary information',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_element_details',
                        description: 'Get full details for a specific captured element',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: 'Element ID'
                                }
                            },
                            required: ['id']
                        }
                    },
                    {
                        name: 'search_elements',
                        description: 'Search captured elements by selector, text, or URL',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query (searches selector, text, HTML, and URL)'
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'remove_element',
                        description: 'Remove a captured element by ID',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: 'Element ID to remove'
                                }
                            },
                            required: ['id']
                        }
                    },
                    {
                        name: 'clear_all_elements',
                        description: 'Clear all captured elements from storage',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_storage_stats',
                        description: 'Get storage statistics (count, TTL, timestamps)',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_server_status',
                        description: 'Get WebSocket server status and connection info',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                ]
            }
        })

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params

            switch (name) {
                case 'list_captured_elements': {
                    const elements = this.storage.getAll()
                    const summaries = elements.map(summarizeElement)
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(summaries, null, 2)
                        }]
                    }
                }

                case 'get_element_details': {
                    const element = this.storage.get(args.id)
                    if (!element) {
                        return {
                            content: [{
                                type: 'text',
                                text: `Error: Element not found: ${args.id}`
                            }],
                            isError: true
                        }
                    }
                    // Exclude screenshot from details to avoid token limits
                    // Screenshot can be accessed via element://{id}/screenshot resource
                    const { screenshot, ...elementWithoutScreenshot } = element
                    const detailsWithMeta = {
                        ...elementWithoutScreenshot,
                        _hasScreenshot: !!screenshot,
                        _screenshotAvailable: screenshot ? `element://${args.id}/screenshot` : null
                    }
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(detailsWithMeta, null, 2)
                        }]
                    }
                }

                case 'search_elements': {
                    const results = this.storage.search(args.query)
                    const summaries = results.map(summarizeElement)
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(summaries, null, 2)
                        }]
                    }
                }

                case 'remove_element': {
                    const removed = this.storage.remove(args.id)
                    return {
                        content: [{
                            type: 'text',
                            text: removed
                                ? `Successfully removed element: ${args.id}`
                                : `Element not found: ${args.id}`
                        }]
                    }
                }

                case 'clear_all_elements': {
                    this.storage.clear()
                    return {
                        content: [{
                            type: 'text',
                            text: 'All elements cleared from storage'
                        }]
                    }
                }

                case 'get_storage_stats': {
                    const stats = this.storage.getStats()
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(stats, null, 2)
                        }]
                    }
                }

                case 'get_server_status': {
                    const status = this.wsServer.getStatus()
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(status, null, 2)
                        }]
                    }
                }

                default:
                    return {
                        content: [{
                            type: 'text',
                            text: `Unknown tool: ${name}`
                        }],
                        isError: true
                    }
            }
        })
    }

    /**
     * Start the MCP server
     */
    async start() {
        const transport = new StdioServerTransport()
        await this.server.connect(transport)
        console.error('MCP server started (stdio transport)')
    }

    /**
     * Stop the MCP server
     */
    async stop() {
        await this.server.close()
        console.error('MCP server stopped')
    }
}
