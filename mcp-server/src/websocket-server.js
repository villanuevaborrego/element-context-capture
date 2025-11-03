/**
 * WebSocket server for Chrome extension communication
 */

import { WebSocketServer } from 'ws'

const DEFAULT_PORT = 38100
const FALLBACK_PORTS = [38101, 38102, 38103]

export class ExtensionWebSocketServer {
    constructor(storage, options = {}) {
        this.storage = storage
        this.port = options.port || DEFAULT_PORT
        this.wss = null
        this.clients = new Set()
    }

    /**
     * Start the WebSocket server
     * @returns {Promise<number>} Actual port used
     */
    async start() {
        return new Promise((resolve, reject) => {
            const tryPort = (port, fallbackPorts = []) => {
                this.wss = new WebSocketServer({ port }, () => {
                    console.log(`WebSocket server listening on port ${port}`)
                    this.setupHandlers()
                    resolve(port)
                })

                this.wss.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.warn(`Port ${port} in use, trying next...`)
                        if (fallbackPorts.length > 0) {
                            const nextPort = fallbackPorts.shift()
                            tryPort(nextPort, fallbackPorts)
                        } else {
                            reject(new Error('All ports in use'))
                        }
                    } else {
                        reject(error)
                    }
                })
            }

            tryPort(this.port, [...FALLBACK_PORTS])
        })
    }

    /**
     * Setup WebSocket event handlers
     */
    setupHandlers() {
        this.wss.on('connection', (ws, req) => {
            const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`
            console.log(`Extension client connected: ${clientId}`)
            this.clients.add(ws)

            ws.on('message', (data) => {
                this.handleMessage(ws, data, clientId)
            })

            ws.on('close', () => {
                console.log(`Extension client disconnected: ${clientId}`)
                this.clients.delete(ws)
            })

            ws.on('error', (error) => {
                console.error(`WebSocket error for ${clientId}:`, error)
            })

            // Send welcome message
            this.sendMessage(ws, {
                type: 'WELCOME',
                data: {
                    serverVersion: '1.0.0',
                    maxElements: this.storage.maxElements,
                    ttl: this.storage.ttl
                }
            })
        })
    }

    /**
     * Handle incoming WebSocket message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Buffer} data - Message data
     * @param {string} clientId - Client identifier
     */
    handleMessage(ws, data, clientId) {
        try {
            const message = JSON.parse(data.toString())
            console.log(`Message from ${clientId}: ${message.type}`)

            switch (message.type) {
                case 'ELEMENT_CAPTURED':
                    this.handleElementCaptured(ws, message.element)
                    break

                case 'PING':
                    this.sendMessage(ws, { type: 'PONG', timestamp: Date.now() })
                    break

                case 'GET_STATS':
                    this.sendMessage(ws, {
                        type: 'STATS',
                        data: this.storage.getStats()
                    })
                    break

                case 'GET_ELEMENTS':
                    this.sendMessage(ws, {
                        type: 'ELEMENTS_LIST',
                        elements: this.storage.getAll()
                    })
                    break

                case 'REMOVE_ELEMENT':
                    this.storage.remove(message.id)
                    this.sendMessage(ws, {
                        type: 'ELEMENT_REMOVED',
                        id: message.id
                    })
                    break

                case 'CLEAR_ALL':
                    this.storage.clear()
                    this.sendMessage(ws, {
                        type: 'ALL_CLEARED'
                    })
                    break

                default:
                    console.warn(`Unknown message type: ${message.type}`)
                    this.sendMessage(ws, {
                        type: 'ERROR',
                        error: `Unknown message type: ${message.type}`
                    })
            }
        } catch (error) {
            console.error('Error handling message:', error)
            this.sendMessage(ws, {
                type: 'ERROR',
                error: error.message
            })
        }
    }

    /**
     * Handle element captured event
     * @param {WebSocket} ws - WebSocket connection
     * @param {import('./schema.js').CapturedElement} element - Captured element
     */
    handleElementCaptured(ws, element) {
        const success = this.storage.add(element)

        if (success) {
            this.sendMessage(ws, {
                type: 'ELEMENT_STORED',
                data: {
                    id: element.id,
                    selector: element.selector,
                    timestamp: element.timestamp
                }
            })

            // Broadcast to all clients that a new element was captured
            this.broadcast({
                type: 'ELEMENT_ADDED',
                data: {
                    id: element.id,
                    selector: element.selector,
                    url: element.url
                }
            }, ws) // Exclude sender
        } else {
            this.sendMessage(ws, {
                type: 'ERROR',
                error: 'Failed to store element'
            })
        }
    }

    /**
     * Send message to a WebSocket client
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    sendMessage(ws, message) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(message))
        }
    }

    /**
     * Broadcast message to all clients
     * @param {Object} message - Message to broadcast
     * @param {WebSocket} [exclude] - Client to exclude from broadcast
     */
    broadcast(message, exclude = null) {
        const data = JSON.stringify(message)
        for (const client of this.clients) {
            if (client !== exclude && client.readyState === client.OPEN) {
                client.send(data)
            }
        }
    }

    /**
     * Stop the WebSocket server
     */
    stop() {
        if (this.wss) {
            console.log('Stopping WebSocket server...')
            for (const client of this.clients) {
                client.close()
            }
            this.clients.clear()
            this.wss.close()
            this.wss = null
        }
    }

    /**
     * Get server status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            running: !!this.wss,
            port: this.port,
            clients: this.clients.size
        }
    }
}
