/**
 * Element context capturer
 * Extracts comprehensive information about HTML elements
 */

// Ensure namespace exists
window.ElementContextCapture = window.ElementContextCapture || {};

/**
 * Capture full context for an HTML element
 * @param {HTMLElement} element - Element to capture
 * @returns {Promise<Object>} Captured element data
 */
window.ElementContextCapture.captureElement = async function captureElement(element) {
    const selector = window.ElementContextCapture.generateUniqueSelector(element)
    const computed = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    // Generate unique ID
    const id = crypto.randomUUID()

    // Capture screenshot
    const screenshot = await captureElementScreenshot(element)

    // Extract attributes
    const attributes = {}
    for (const attr of element.attributes) {
        attributes[attr.name] = attr.value
    }

    // Get key computed styles
    const computedStyles = {
        display: computed.display,
        position: computed.position,
        width: computed.width,
        height: computed.height,
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        padding: computed.padding,
        margin: computed.margin,
        border: computed.border,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        zIndex: computed.zIndex,
        opacity: computed.opacity,
        visibility: computed.visibility,
        overflow: computed.overflow
    }

    // Get element context (parent, siblings, children)
    const context = {
        parent: window.ElementContextCapture.getParentSelector(element),
        siblings: element.parentElement ? element.parentElement.children.length - 1 : 0,
        children: element.children.length
    }

    return {
        id,
        timestamp: Date.now(),
        url: window.location.href,
        selector,
        html: sanitizeHTML(element.outerHTML),
        text: element.innerText || element.textContent || '',
        attributes,
        computed: computedStyles,
        bounds: {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height
        },
        screenshot,
        context
    }
}

/**
 * Capture screenshot of an element
 * @param {HTMLElement} element - Element to screenshot
 * @returns {Promise<string>} Base64 encoded image
 */
async function captureElementScreenshot(element) {
    try {
        const rect = element.getBoundingClientRect()

        // Use html2canvas if available, otherwise return empty string
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(element, {
                backgroundColor: null,
                logging: false,
                width: rect.width,
                height: rect.height
            })
            return canvas.toDataURL('image/webp', 0.8)
        }

        // Fallback: Use canvas to capture visible portion
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const scale = window.devicePixelRatio || 1
        canvas.width = rect.width * scale
        canvas.height = rect.height * scale
        canvas.style.width = rect.width + 'px'
        canvas.style.height = rect.height + 'px'
        ctx.scale(scale, scale)

        // Try to capture using drawWindow (if available, Firefox only)
        if (typeof ctx.drawWindow === 'function') {
            ctx.drawWindow(
                window,
                rect.left + window.scrollX,
                rect.top + window.scrollY,
                rect.width,
                rect.height,
                'rgb(255,255,255)'
            )
            return canvas.toDataURL('image/webp', 0.8)
        }

        // Note: For Chrome/Edge, we'll need to use chrome.tabs.captureVisibleTab
        // This will be handled by the background script
        return '' // Empty for now, will be populated by background script

    } catch (error) {
        console.error('Screenshot capture failed:', error)
        return ''
    }
}

/**
 * Sanitize HTML for security
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
    // Remove script tags
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Remove event handlers
    html = html.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '')
    html = html.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '')

    // Limit size
    const MAX_HTML_SIZE = 50000
    if (html.length > MAX_HTML_SIZE) {
        html = html.substring(0, MAX_HTML_SIZE) + '... [TRUNCATED]'
    }

    return html
}

/**
 * Highlight an element visually
 * @param {HTMLElement} element - Element to highlight
 * @param {number} duration - Highlight duration in ms
 */
window.ElementContextCapture.highlightElement = function highlightElement(element, duration = 2000) {
    const originalOutline = element.style.outline
    const originalOutlineOffset = element.style.outlineOffset
    const originalBoxShadow = element.style.boxShadow

    // Apply highlight
    element.style.outline = '3px solid #4A90E2'
    element.style.outlineOffset = '2px'
    element.style.boxShadow = '0 0 0 3px rgba(74, 144, 226, 0.3)'

    // Remove after duration
    setTimeout(() => {
        element.style.outline = originalOutline
        element.style.outlineOffset = originalOutlineOffset
        element.style.boxShadow = originalBoxShadow
    }, duration)
}
