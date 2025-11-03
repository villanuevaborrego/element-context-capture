/**
 * Data schema for captured elements
 */

/**
 * @typedef {Object} ElementBounds
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} width - Element width
 * @property {number} height - Element height
 */

/**
 * @typedef {Object} ComputedStyles
 * @property {string} display - CSS display property
 * @property {string} position - CSS position property
 * @property {string} width - CSS width
 * @property {string} height - CSS height
 * @property {string} backgroundColor - CSS background color
 * @property {string} color - CSS text color
 * @property {string} fontSize - CSS font size
 * @property {string} fontFamily - CSS font family
 * @property {string} padding - CSS padding
 * @property {string} margin - CSS margin
 * @property {string} border - CSS border
 * @property {string} zIndex - CSS z-index
 */

/**
 * @typedef {Object} ElementContext
 * @property {string} parent - Parent element selector
 * @property {number} siblings - Number of sibling elements
 * @property {number} children - Number of child elements
 */

/**
 * @typedef {Object} CapturedElement
 * @property {string} id - Unique UUID for this capture
 * @property {number} timestamp - Capture timestamp (ms since epoch)
 * @property {string} url - Page URL where element was captured
 * @property {string} selector - Unique CSS selector for the element
 * @property {string} html - Outer HTML (sanitized)
 * @property {string} text - Inner text content
 * @property {Object.<string, string>} attributes - HTML attributes
 * @property {ComputedStyles} computed - Computed CSS styles
 * @property {ElementBounds} bounds - Element position and size
 * @property {string} screenshot - Base64 encoded WebP/PNG screenshot
 * @property {ElementContext} context - Parent/sibling/child information
 */

/**
 * Validates a captured element object
 * @param {any} data - Data to validate
 * @returns {boolean} True if valid
 */
export function validateCapturedElement(data) {
    if (!data || typeof data !== 'object') return false

    const required = ['id', 'timestamp', 'url', 'selector', 'html', 'text']
    for (const field of required) {
        if (!(field in data)) return false
    }

    if (typeof data.id !== 'string' || !data.id) return false
    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) return false
    if (typeof data.url !== 'string' || !data.url.startsWith('http')) return false
    if (typeof data.selector !== 'string' || !data.selector) return false

    return true
}

/**
 * Sanitizes captured element data for security
 * @param {CapturedElement} element - Element to sanitize
 * @returns {CapturedElement} Sanitized element
 */
export function sanitizeElement(element) {
    const sanitized = { ...element }

    // Remove script tags from HTML
    if (sanitized.html) {
        sanitized.html = sanitized.html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove event handlers
        sanitized.html = sanitized.html.replace(/\son\w+="[^"]*"/gi, '')
    }

    // Redact sensitive attributes
    if (sanitized.attributes) {
        const sensitiveAttrs = ['password', 'token', 'secret', 'key', 'auth']
        for (const attr in sanitized.attributes) {
            if (sensitiveAttrs.some(s => attr.toLowerCase().includes(s))) {
                sanitized.attributes[attr] = '[REDACTED]'
            }
        }
    }

    // Limit sizes
    const MAX_HTML_SIZE = 50000 // 50KB
    const MAX_TEXT_SIZE = 10000  // 10KB
    const MAX_SCREENSHOT_SIZE = 1000000 // 1MB

    if (sanitized.html && sanitized.html.length > MAX_HTML_SIZE) {
        sanitized.html = sanitized.html.substring(0, MAX_HTML_SIZE) + '... [TRUNCATED]'
    }

    if (sanitized.text && sanitized.text.length > MAX_TEXT_SIZE) {
        sanitized.text = sanitized.text.substring(0, MAX_TEXT_SIZE) + '... [TRUNCATED]'
    }

    if (sanitized.screenshot && sanitized.screenshot.length > MAX_SCREENSHOT_SIZE) {
        sanitized.screenshot = '' // Remove oversized screenshots
        sanitized._screenshotTruncated = true
    }

    return sanitized
}

/**
 * Creates a summary of an element for listing
 * @param {CapturedElement} element - Element to summarize
 * @returns {Object} Summary object
 */
export function summarizeElement(element) {
    return {
        id: element.id,
        timestamp: element.timestamp,
        url: element.url,
        selector: element.selector,
        text: element.text?.substring(0, 100) || '',
        bounds: element.bounds,
        hasScreenshot: !!element.screenshot
    }
}
