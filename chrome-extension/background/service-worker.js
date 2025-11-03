/**
 * Background service worker for Element Context Capture
 * Manages WebSocket connection to MCP server and context menu
 */

// Configuration
const WS_SERVER_URL = 'ws://localhost:38100'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 5

// State
let ws = null
let reconnectAttempts = 0
let reconnectTimer = null
let connectionStatus = 'disconnected' // disconnected, connecting, connected

/**
 * Initialize background service
 */
function init() {
    console.log('[Element Context Capture] Background service worker started')

    // Setup context menu
    setupContextMenu()

    // Connect to WebSocket server
    connectToServer()

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(handleMessage)

    // Setup periodic ping to keep connection alive
    setInterval(pingServer, 30000) // Every 30 seconds
}

/**
 * Setup context menu
 */
function setupContextMenu() {
    chrome.contextMenus.create({
        id: 'add-to-claude-context',
        title: 'Add to Claude Context',
        contexts: ['all']
    })

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'add-to-claude-context') {
            handleContextMenuClick(info, tab)
        }
    })

    console.log('[Element Context Capture] Context menu created')
}

/**
 * Handle context menu click
 * @param {Object} info - Click info
 * @param {Object} tab - Tab info
 */
async function handleContextMenuClick(info, tab) {
    try {
        // First, ensure content script is injected
        await ensureContentScriptLoaded(tab.id)

        // Give it a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 100))

        // Send message to content script to capture the last right-clicked element
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'CAPTURE_CONTEXT_MENU_TARGET'
        })

        if (!response || !response.success) {
            console.error('[Element Context Capture] Context menu capture failed', response)
        } else {
            console.log('[Element Context Capture] Element captured successfully')
        }
    } catch (error) {
        console.error('[Element Context Capture] Context menu error:', error)
        console.error('Error details:', error.message, error.stack)
        // Show user-friendly notification
        chrome.notifications?.create({
            type: 'basic',
            iconUrl: '../icons/icon48.png',
            title: 'Element Context Capture',
            message: 'Failed to capture element. Try refreshing the page.'
        })
    }
}

/**
 * Ensure content script is loaded in tab
 * @param {number} tabId - Tab ID
 */
async function ensureContentScriptLoaded(tabId) {
    try {
        // Try to ping the content script
        await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    } catch (error) {
        // Content script not loaded, inject it manually
        console.log('[Element Context Capture] Injecting content scripts...')

        await chrome.scripting.executeScript({
            target: { tabId },
            files: [
                'content/selector-generator.js',
                'content/element-capturer.js',
                'content/content-script.js'
            ]
        })
    }
}

/**
 * Connect to WebSocket server
 */
function connectToServer() {
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') {
        return
    }

    console.log('[Element Context Capture] Connecting to MCP server...')
    connectionStatus = 'connecting'

    try {
        ws = new WebSocket(WS_SERVER_URL)

        ws.onopen = handleWebSocketOpen
        ws.onclose = handleWebSocketClose
        ws.onerror = handleWebSocketError
        ws.onmessage = handleWebSocketMessage

    } catch (error) {
        console.error('[Element Context Capture] WebSocket creation failed:', error)
        scheduleReconnect()
    }
}

/**
 * Handle WebSocket open
 */
function handleWebSocketOpen() {
    console.log('[Element Context Capture] Connected to MCP server')
    connectionStatus = 'connected'
    reconnectAttempts = 0

    // Update extension icon
    updateIcon('connected')
}

/**
 * Handle WebSocket close
 */
function handleWebSocketClose(event) {
    console.log('[Element Context Capture] Disconnected from MCP server')
    connectionStatus = 'disconnected'
    ws = null

    // Update extension icon
    updateIcon('disconnected')

    // Schedule reconnect
    if (!event.wasClean) {
        scheduleReconnect()
    }
}

/**
 * Handle WebSocket error
 */
function handleWebSocketError(error) {
    console.error('[Element Context Capture] WebSocket error:', error)
    connectionStatus = 'disconnected'

    // Update extension icon
    updateIcon('error')
}

// Store pending element requests
const pendingElementRequests = []

/**
 * Request elements from server
 * @param {Function} sendResponse - Response callback
 */
function requestElements(sendResponse) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Store callback for when response arrives
        pendingElementRequests.push(sendResponse)
        sendToServer({ type: 'GET_ELEMENTS' })
    } else {
        sendResponse({ elements: [] })
    }
}

/**
 * Handle WebSocket message
 * @param {MessageEvent} event
 */
function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data)
        console.log('[Element Context Capture] Server message:', message.type)

        switch (message.type) {
            case 'WELCOME':
                console.log('[Element Context Capture] Server version:', message.data.serverVersion)
                break

            case 'ELEMENT_STORED':
                console.log('[Element Context Capture] Element stored:', message.data.selector)
                // Notify content script
                notifyContentScript('ELEMENT_STORED', message.data)
                break

            case 'ELEMENTS_LIST':
                console.log('[Element Context Capture] Received elements list:', message.elements.length)
                // Respond to all pending requests
                while (pendingElementRequests.length > 0) {
                    const callback = pendingElementRequests.shift()
                    callback({ elements: message.elements })
                }
                break

            case 'ERROR':
                console.error('[Element Context Capture] Server error:', message.error)
                break

            case 'PONG':
                console.log('[Element Context Capture] Pong received')
                break

            default:
                console.warn('[Element Context Capture] Unknown message type:', message.type)
        }
    } catch (error) {
        console.error('[Element Context Capture] Message parse error:', error)
    }
}

/**
 * Schedule reconnection attempt
 */
function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[Element Context Capture] Max reconnection attempts reached')
        return
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer)
    }

    reconnectAttempts++
    const delay = RECONNECT_DELAY * reconnectAttempts

    console.log(`[Element Context Capture] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)

    reconnectTimer = setTimeout(() => {
        connectToServer()
    }, delay)
}

/**
 * Send message to WebSocket server
 * @param {Object} message - Message to send
 */
function sendToServer(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
    } else {
        console.warn('[Element Context Capture] Cannot send message: not connected')
        // Attempt to reconnect
        if (connectionStatus === 'disconnected') {
            connectToServer()
        }
    }
}

/**
 * Ping server to keep connection alive
 */
function pingServer() {
    if (connectionStatus === 'connected') {
        sendToServer({ type: 'PING' })
    }
}

/**
 * Handle messages from content scripts
 * @param {Object} message - Message from content script
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response callback
 */
function handleMessage(message, sender, sendResponse) {
    switch (message.type) {
        case 'ELEMENT_CAPTURED':
            handleElementCaptured(message.element)
            sendResponse({ success: true })
            break

        case 'CAPTURE_SCREENSHOT':
            captureElementScreenshot(sender.tab.id, message.bounds)
                .then(screenshot => sendResponse({ screenshot }))
                .catch(error => sendResponse({ screenshot: '', error: error.message }))
            return true // Async response

        case 'GET_CONNECTION_STATUS':
            sendResponse({ status: connectionStatus })
            break

        case 'GET_CAPTURED_ELEMENTS':
            // Request elements from MCP server via WebSocket
            requestElements(sendResponse)
            return true // Async response

        case 'CLEAR_ALL_ELEMENTS':
            sendToServer({ type: 'CLEAR_ALL' })
            sendResponse({ success: true })
            break

        case 'REMOVE_ELEMENT':
            sendToServer({ type: 'REMOVE_ELEMENT', id: message.id })
            sendResponse({ success: true })
            break

        default:
            console.warn('[Element Context Capture] Unknown message type:', message.type)
    }
}

/**
 * Handle element captured from content script
 * @param {Object} element - Captured element data
 */
function handleElementCaptured(element) {
    console.log('[Element Context Capture] Element captured:', element.selector)

    // Send to MCP server via WebSocket
    sendToServer({
        type: 'ELEMENT_CAPTURED',
        element
    })
}

/**
 * Capture screenshot of element bounds
 * @param {number} tabId - Tab ID
 * @param {Object} bounds - Element bounds
 * @returns {Promise<string>} Screenshot data URL
 */
async function captureElementScreenshot(tabId, bounds) {
    try {
        // Capture visible tab
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png'
        })

        // Crop to element bounds (would need canvas processing)
        // For now, return full screenshot
        // TODO: Implement cropping using OffscreenCanvas
        return dataUrl

    } catch (error) {
        console.error('[Element Context Capture] Screenshot failed:', error)
        return ''
    }
}

/**
 * Notify content script
 * @param {string} type - Message type
 * @param {Object} data - Message data
 */
async function notifyContentScript(type, data) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]) {
            await chrome.tabs.sendMessage(tabs[0].id, { type, data })
        }
    } catch (error) {
        console.error('[Element Context Capture] Failed to notify content script:', error)
    }
}

/**
 * Update extension icon based on connection status
 * @param {string} status - Connection status
 */
function updateIcon(status) {
    const icons = {
        connected: {
            path: {
                16: 'icons/icon16.png',
                32: 'icons/icon32.png',
                48: 'icons/icon48.png',
                128: 'icons/icon128.png'
            }
        },
        disconnected: {
            path: {
                16: 'icons/icon16-gray.png',
                32: 'icons/icon32-gray.png',
                48: 'icons/icon48-gray.png',
                128: 'icons/icon128-gray.png'
            }
        },
        error: {
            path: {
                16: 'icons/icon16-red.png',
                32: 'icons/icon32-red.png',
                48: 'icons/icon48-red.png',
                128: 'icons/icon128-red.png'
            }
        }
    }

    const iconSet = icons[status] || icons.disconnected

    chrome.action.setIcon(iconSet).catch(() => {
        // Fallback if colored icons don't exist
        console.warn('[Element Context Capture] Icon files not found, using defaults')
    })
}

// Initialize
init()
