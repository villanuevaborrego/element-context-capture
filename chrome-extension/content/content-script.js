/**
 * Content script for Element Context Capture
 * Handles element inspection and capture
 */

// Ensure namespace exists and get references to functions
(function() {
    'use strict';

    // Wait for other scripts to load
    if (!window.ElementContextCapture) {
        console.error('[Element Context Capture] Dependencies not loaded');
        return;
    }

    const { captureElement, highlightElement } = window.ElementContextCapture;

// State
let inspectionMode = false
let hoveredElement = null
let lastHighlightedElement = null
let lastRightClickedElement = null
let inspectorTooltip = null
let overlayBox = null

/**
 * Create inspector tooltip element
 */
function createInspectorTooltip() {
    if (inspectorTooltip) return inspectorTooltip

    const tooltip = document.createElement('div')
    tooltip.id = 'element-context-capture-inspector-tooltip'
    tooltip.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        font-family: Menlo, Monaco, 'Courier New', monospace;
        font-size: 11px;
        line-height: 1.4;
        background: #242424;
        color: #e8eaed;
        padding: 8px 10px;
        border-radius: 2px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        max-width: 350px;
        display: none;
        border: 1px solid rgba(255, 255, 255, 0.1);
    `
    document.body.appendChild(tooltip)
    inspectorTooltip = tooltip
    return tooltip
}

/**
 * Create overlay box for element highlighting
 */
function createOverlayBox() {
    if (overlayBox) return overlayBox

    // Container for all overlay layers
    const container = document.createElement('div')
    container.id = 'element-context-capture-overlay-box'
    container.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        display: none;
    `

    // Margin layer (orange)
    const marginLayer = document.createElement('div')
    marginLayer.className = 'overlay-margin'
    marginLayer.style.cssText = `
        position: absolute;
        background: rgba(246, 178, 107, 0.2);
        border: 1px solid rgba(246, 178, 107, 0.6);
        box-sizing: border-box;
    `

    // Content + Padding + Border layer (blue - just the content area)
    const contentLayer = document.createElement('div')
    contentLayer.className = 'overlay-content'
    contentLayer.style.cssText = `
        position: absolute;
        background: rgba(111, 168, 220, 0.35);
        border: 1px solid rgba(111, 168, 220, 0.8);
        box-sizing: border-box;
    `

    container.appendChild(marginLayer)
    container.appendChild(contentLayer)
    document.body.appendChild(container)

    overlayBox = {
        container,
        marginLayer,
        contentLayer
    }
    return overlayBox
}

/**
 * Update overlay box position
 * @param {HTMLElement} element - Element to overlay
 */
function updateOverlayBox(element) {
    if (!overlayBox) {
        createOverlayBox()
    }

    const rect = element.getBoundingClientRect()
    const computed = window.getComputedStyle(element)

    // Parse margin values
    const marginTop = parseFloat(computed.marginTop) || 0
    const marginRight = parseFloat(computed.marginRight) || 0
    const marginBottom = parseFloat(computed.marginBottom) || 0
    const marginLeft = parseFloat(computed.marginLeft) || 0

    // Calculate positions
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    // Position container
    overlayBox.container.style.display = 'block'
    overlayBox.container.style.top = `${rect.top + scrollY - marginTop}px`
    overlayBox.container.style.left = `${rect.left + scrollX - marginLeft}px`
    overlayBox.container.style.width = `${rect.width + marginLeft + marginRight}px`
    overlayBox.container.style.height = `${rect.height + marginTop + marginBottom}px`

    // Position margin layer (outermost - includes margins)
    overlayBox.marginLayer.style.top = '0'
    overlayBox.marginLayer.style.left = '0'
    overlayBox.marginLayer.style.width = '100%'
    overlayBox.marginLayer.style.height = '100%'

    // Position content layer (inner - element's border box)
    overlayBox.contentLayer.style.top = `${marginTop}px`
    overlayBox.contentLayer.style.left = `${marginLeft}px`
    overlayBox.contentLayer.style.width = `${rect.width}px`
    overlayBox.contentLayer.style.height = `${rect.height}px`

    // Hide margin layer if no margin
    const hasMargin = marginTop || marginRight || marginBottom || marginLeft
    overlayBox.marginLayer.style.display = hasMargin ? 'block' : 'none'
}

/**
 * Hide overlay box
 */
function hideOverlayBox() {
    if (overlayBox && overlayBox.container) {
        overlayBox.container.style.display = 'none'
    }
}

/**
 * Update inspector tooltip with element info
 * @param {HTMLElement} element - Element to show info for
 * @param {MouseEvent} event - Mouse event for positioning
 */
function updateInspectorTooltip(element, event) {
    if (!inspectorTooltip) {
        createInspectorTooltip()
    }

    const computed = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    // Build tooltip content
    const tagName = element.tagName.toLowerCase()
    const id = element.id ? `#${element.id}` : ''
    const classes = element.className && typeof element.className === 'string'
        ? `.${element.className.split(' ').filter(c => c).join('.')}`
        : ''
    const dimensions = `${Math.round(rect.width)} × ${Math.round(rect.height)}`

    // Color badges with swatches - Chrome DevTools style
    const textColor = computed.color
    const bgColor = computed.backgroundColor

    const colorSwatch = (color) => `<span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border: 1px solid rgba(0, 0, 0, 0.2); border-radius: 1px; margin-right: 6px; vertical-align: text-bottom; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);"></span>`

    // Build selector display - Chrome DevTools colors
    let selectorDisplay = `<span style="color: #e06c75;">${tagName}</span>`
    if (id) selectorDisplay += `<span style="color: #d19a66;">${id}</span>`
    if (classes) selectorDisplay += `<span style="color: #98c379;">${classes}</span>`

    // Build content - clean and minimal
    let content = `<div style="font-weight: 500;">${selectorDisplay} <span style="color: #5c6370;">${dimensions}</span></div>`

    // Add color info if visible - more compact
    const colorInfo = []
    if (bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        const shortBg = rgbToHex(bgColor) || bgColor
        colorInfo.push(`${colorSwatch(bgColor)}<span style="color: #abb2bf;">bg: ${shortBg}</span>`)
    }

    if (textColor && textColor !== 'rgb(0, 0, 0)') {
        const shortText = rgbToHex(textColor) || textColor
        colorInfo.push(`${colorSwatch(textColor)}<span style="color: #abb2bf;">color: ${shortText}</span>`)
    }

    if (colorInfo.length > 0) {
        content += `<div style="margin-top: 6px; font-size: 10px;">${colorInfo.join(' ')}</div>`
    }

    inspectorTooltip.innerHTML = content
    inspectorTooltip.style.display = 'block'

    // Position tooltip (follow cursor with offset)
    const tooltipRect = inspectorTooltip.getBoundingClientRect()
    const offsetX = 15
    const offsetY = 15

    let left = event.clientX + offsetX
    let top = event.clientY + offsetY

    // Keep tooltip within viewport
    if (left + tooltipRect.width > window.innerWidth) {
        left = event.clientX - tooltipRect.width - offsetX
    }
    if (top + tooltipRect.height > window.innerHeight) {
        top = event.clientY - tooltipRect.height - offsetY
    }

    inspectorTooltip.style.left = `${left}px`
    inspectorTooltip.style.top = `${top}px`
}

/**
 * Convert RGB to Hex color
 * @param {string} rgb - RGB color string
 * @returns {string} Hex color
 */
function rgbToHex(rgb) {
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/)
    if (!match) return null

    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])

    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }).join('')
}

/**
 * Hide inspector tooltip
 */
function hideInspectorTooltip() {
    if (inspectorTooltip) {
        inspectorTooltip.style.display = 'none'
    }
}

/**
 * Initialize content script
 */
function init() {
    console.log('[Element Context Capture] Content script loaded')

    // Create inspector tooltip and overlay box
    createInspectorTooltip()
    createOverlayBox()

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'PING':
                // Respond immediately to confirm script is loaded
                sendResponse({ success: true, ready: true })
                break

            case 'TOGGLE_INSPECTION_MODE':
                toggleInspectionMode()
                sendResponse({ success: true, inspectionMode })
                break

            case 'CAPTURE_CONTEXT_MENU_TARGET':
                captureContextMenuTarget(message.element)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }))
                return true // Async response

            default:
                console.warn('[Element Context Capture] Unknown message type:', message.type)
        }
    })

    // Setup keyboard shortcut listener
    document.addEventListener('keydown', handleKeyPress)

    // Track right-clicked elements for context menu
    document.addEventListener('contextmenu', handleContextMenu, true)
}

/**
 * Track which element was right-clicked
 * @param {MouseEvent} event
 */
function handleContextMenu(event) {
    lastRightClickedElement = event.target
    console.log('[Element Context Capture] Right-clicked element:', event.target)
}

/**
 * Toggle inspection mode
 */
function toggleInspectionMode() {
    inspectionMode = !inspectionMode

    if (inspectionMode) {
        enableInspectionMode()
    } else {
        disableInspectionMode()
    }

    console.log('[Element Context Capture] Inspection mode:', inspectionMode)
}

/**
 * Enable inspection mode
 */
function enableInspectionMode() {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('click', handleClick, true)
    document.body.style.cursor = 'crosshair'

    // Show notification
    showNotification('Inspection mode enabled. Click an element to capture.')
}

/**
 * Disable inspection mode
 */
function disableInspectionMode() {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('click', handleClick, true)
    document.body.style.cursor = ''

    // Clear hover highlight
    if (lastHighlightedElement) {
        clearHighlight(lastHighlightedElement)
        lastHighlightedElement = null
    }

    // Hide tooltip and overlay
    hideInspectorTooltip()
    hideOverlayBox()
}

/**
 * Handle mouse move for hover detection
 * @param {MouseEvent} event
 */
function handleMouseMove(event) {
    const element = event.target

    if (element !== lastHighlightedElement) {
        // Clear previous highlight
        if (lastHighlightedElement) {
            clearHighlight(lastHighlightedElement)
        }

        // Highlight new element
        applyHoverHighlight(element)
        lastHighlightedElement = element
        hoveredElement = element

        // Update overlay box
        updateOverlayBox(element)
    }

    // Update tooltip position and content
    updateInspectorTooltip(element, event)
}

/**
 * Handle click to capture element
 * @param {MouseEvent} event
 */
async function handleClick(event) {
    if (!inspectionMode) return

    event.preventDefault()
    event.stopPropagation()

    const element = hoveredElement || event.target

    // Disable inspection mode
    disableInspectionMode()
    inspectionMode = false

    // Capture element
    await captureAndSend(element)
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event
 */
function handleKeyPress(event) {
    // Alt+Shift+C to toggle inspection mode
    if (event.altKey && event.shiftKey && event.code === 'KeyC') {
        event.preventDefault()
        toggleInspectionMode()
    }

    // ESC to exit inspection mode
    if (event.code === 'Escape' && inspectionMode) {
        event.preventDefault()
        toggleInspectionMode()
    }
}

/**
 * Capture element from context menu
 * @param {Object} elementInfo - Element information from background script
 */
async function captureContextMenuTarget(elementInfo) {
    console.log('[Element Context Capture] captureContextMenuTarget called')

    // Use the last right-clicked element (tracked by contextmenu event)
    let element = lastRightClickedElement

    if (element) {
        console.log('[Element Context Capture] Capturing last right-clicked element:', element.tagName, element.className)
        await captureAndSend(element)
        // Clear after capture
        lastRightClickedElement = null
    } else {
        console.error('[Element Context Capture] No element found to capture')
        throw new Error('Element not found - try right-clicking again')
    }
}

/**
 * Capture element and send to background
 * @param {HTMLElement} element - Element to capture
 */
async function captureAndSend(element) {
    try {
        showNotification('Capturing element...')

        // Highlight element
        highlightElement(element, 2000)

        // Capture element data
        const elementData = await captureElement(element)

        // Request screenshot from background if not captured
        if (!elementData.screenshot) {
            const screenshot = await requestElementScreenshot(element)
            elementData.screenshot = screenshot
        }

        // Send to background script
        chrome.runtime.sendMessage({
            type: 'ELEMENT_CAPTURED',
            element: elementData
        }, (response) => {
            if (response && response.success) {
                showNotification('✓ Element captured successfully', 'success')
            } else {
                showNotification('✗ Failed to capture element', 'error')
            }
        })

    } catch (error) {
        console.error('[Element Context Capture] Capture failed:', error)
        showNotification('✗ Error: ' + error.message, 'error')
    }
}

/**
 * Request element screenshot from background script
 * @param {HTMLElement} element - Element to screenshot
 * @returns {Promise<string>} Screenshot data URL
 */
async function requestElementScreenshot(element) {
    const rect = element.getBoundingClientRect()

    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            type: 'CAPTURE_SCREENSHOT',
            bounds: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            }
        }, (response) => {
            resolve(response?.screenshot || '')
        })
    })
}

/**
 * Apply hover highlight to element
 * @param {HTMLElement} element
 */
function applyHoverHighlight(element) {
    // No longer needed - using overlay boxes instead
}

/**
 * Clear highlight from element
 * @param {HTMLElement} element
 */
function clearHighlight(element) {
    // No longer needed - using overlay boxes instead
}

/**
 * Show notification to user
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, error)
 */
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('element-context-capture-notification')
    if (existing) {
        existing.remove()
    }

    // Create notification
    const notification = document.createElement('div')
    notification.id = 'element-context-capture-notification'
    notification.textContent = message

    // Styles
    const colors = {
        info: { bg: '#4A90E2', text: '#fff' },
        success: { bg: '#5CB85C', text: '#fff' },
        error: { bg: '#D9534F', text: '#fff' }
    }

    const color = colors[type] || colors.info

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: color.bg,
        color: color.text,
        padding: '12px 20px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '999999',
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '500',
        maxWidth: '300px',
        animation: 'slideInRight 0.3s ease-out'
    })

    // Add animation
    const style = document.createElement('style')
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `
    document.head.appendChild(style)

    document.body.appendChild(notification)

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s'
        notification.style.opacity = '0'
        setTimeout(() => notification.remove(), 300)
    }, 3000)
}

// Initialize
init()

})(); // End of IIFE
