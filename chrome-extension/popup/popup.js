/**
 * Popup UI controller
 */

// State
let elements = []
let connectionStatus = 'disconnected'

// DOM Elements
const toggleInspectionBtn = document.getElementById('toggleInspection')
const clearAllBtn = document.getElementById('clearAll')
const elementsList = document.getElementById('elementsList')
const connectionStatusEl = document.getElementById('connectionStatus')
const capturedCountEl = document.getElementById('capturedCount')
const storageUsageEl = document.getElementById('storageUsage')

/**
 * Initialize popup
 */
async function init() {
    // Setup event listeners
    toggleInspectionBtn.addEventListener('click', toggleInspection)
    clearAllBtn.addEventListener('click', clearAllElements)

    // Check connection status
    await updateConnectionStatus()

    // Load elements
    await loadElements()

    // Auto-refresh every 5 seconds
    setInterval(loadElements, 5000)
}

/**
 * Toggle inspection mode
 */
async function toggleInspection() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'TOGGLE_INSPECTION_MODE'
        })

        if (response && response.inspectionMode) {
            toggleInspectionBtn.textContent = 'Stop Inspection'
            toggleInspectionBtn.classList.add('active')
        } else {
            toggleInspectionBtn.textContent = 'Start Inspection'
            toggleInspectionBtn.classList.remove('active')
        }
    } catch (error) {
        console.error('Failed to toggle inspection:', error)
    }
}

/**
 * Clear all captured elements
 */
async function clearAllElements() {
    if (!confirm('Clear all captured elements?')) {
        return
    }

    try {
        // Send message to background to clear via MCP
        const response = await chrome.runtime.sendMessage({
            type: 'CLEAR_ALL_ELEMENTS'
        })

        if (response && response.success) {
            await loadElements()
        }
    } catch (error) {
        console.error('Failed to clear elements:', error)
    }
}

/**
 * Load captured elements
 */
async function loadElements() {
    try {
        // Get elements from background via MCP
        const response = await chrome.runtime.sendMessage({
            type: 'GET_CAPTURED_ELEMENTS'
        })

        if (response && response.elements) {
            elements = response.elements
            renderElements()
            updateStats()
        }
    } catch (error) {
        console.error('Failed to load elements:', error)
        // Render empty state
        renderElements()
    }
}

/**
 * Render elements list
 */
function renderElements() {
    if (elements.length === 0) {
        elementsList.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="12" width="32" height="24" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 20H32M16 24H28M16 28H24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>No elements captured yet</p>
                <small>Right-click any element and select "Add to Claude Context"</small>
            </div>
        `
        clearAllBtn.disabled = true
        return
    }

    clearAllBtn.disabled = false

    elementsList.innerHTML = elements.map(element => `
        <div class="element-card" data-id="${element.id}">
            <div class="element-header">
                <code class="element-selector" title="${escapeHtml(element.selector)}">${escapeHtml(element.selector)}</code>
                <div class="element-actions">
                    <button class="icon-btn" data-action="copy" title="Copy selector">
                        📋
                    </button>
                    <button class="icon-btn" data-action="remove" title="Remove">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="element-info">
                <div class="element-text">${escapeHtml(element.text || '(no text)')}</div>
                <div class="element-meta">
                    <span class="element-url" title="${escapeHtml(element.url)}">${new URL(element.url).hostname}</span>
                    <span class="element-time">${formatTime(element.timestamp)}</span>
                </div>
            </div>
        </div>
    `).join('')

    // Attach event listeners
    elementsList.querySelectorAll('.element-card').forEach(card => {
        const id = card.dataset.id

        card.querySelector('[data-action="copy"]')?.addEventListener('click', (e) => {
            e.stopPropagation()
            copySelector(id)
        })

        card.querySelector('[data-action="remove"]')?.addEventListener('click', (e) => {
            e.stopPropagation()
            removeElement(id)
        })

        card.addEventListener('click', () => {
            showElementDetails(id)
        })
    })
}

/**
 * Update stats display
 */
function updateStats() {
    capturedCountEl.textContent = elements.length

    // Get max elements from storage config (default 50)
    const maxElements = 50
    storageUsageEl.textContent = `${elements.length}/${maxElements}`
}

/**
 * Update connection status
 */
async function updateConnectionStatus() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_CONNECTION_STATUS'
        })

        connectionStatus = response.status || 'disconnected'

        const statusDot = connectionStatusEl.querySelector('.status-dot')
        const statusText = connectionStatusEl.querySelector('.status-text')

        statusDot.className = `status-dot ${connectionStatus}`

        const statusMessages = {
            connected: 'Connected',
            connecting: 'Connecting...',
            disconnected: 'Disconnected'
        }

        statusText.textContent = statusMessages[connectionStatus] || 'Unknown'

    } catch (error) {
        console.error('Failed to get connection status:', error)
    }
}

/**
 * Copy selector to clipboard
 * @param {string} id - Element ID
 */
async function copySelector(id) {
    const element = elements.find(el => el.id === id)
    if (!element) return

    try {
        await navigator.clipboard.writeText(element.selector)
        showToast('Selector copied!')
    } catch (error) {
        console.error('Failed to copy selector:', error)
    }
}

/**
 * Remove element
 * @param {string} id - Element ID
 */
async function removeElement(id) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'REMOVE_ELEMENT',
            id
        })

        if (response && response.success) {
            await loadElements()
        }
    } catch (error) {
        console.error('Failed to remove element:', error)
    }
}

/**
 * Show element details
 * @param {string} id - Element ID
 */
function showElementDetails(id) {
    const element = elements.find(el => el.id === id)
    if (!element) return

    // Open details in a new popup or expand inline
    // For now, just copy the selector
    copySelector(id)
}

/**
 * Show toast notification
 * @param {string} message - Toast message
 */
function showToast(message) {
    const toast = document.createElement('div')
    toast.textContent = message
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: #fff;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        animation: fadeIn 0.2s, fadeOut 0.2s 1.8s;
    `

    document.body.appendChild(toast)

    setTimeout(() => {
        toast.remove()
    }, 2000)
}

/**
 * Escape HTML for safe rendering
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
}

/**
 * Format timestamp as relative time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time
 */
function formatTime(timestamp) {
    const now = Date.now()
    const diff = now - timestamp

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 60) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`

    return new Date(timestamp).toLocaleDateString()
}

// Initialize when popup opens
init()

// Update connection status every 5 seconds
setInterval(updateConnectionStatus, 5000)
