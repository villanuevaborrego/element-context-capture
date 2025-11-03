/**
 * Intelligent CSS selector generator
 * Generates unique, stable selectors for HTML elements
 */

// Make functions available globally for other content scripts
window.ElementContextCapture = window.ElementContextCapture || {};

/**
 * Generate a unique CSS selector for an element
 * @param {HTMLElement} element - Target element
 * @returns {string} CSS selector
 */
window.ElementContextCapture.generateUniqueSelector = function generateUniqueSelector(element) {
    // Strategy 1: ID (if unique)
    if (element.id) {
        const idSelector = `#${CSS.escape(element.id)}`
        if (isUnique(idSelector)) {
            return idSelector
        }
    }

    // Strategy 2: Unique class combination
    if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(Boolean)
        if (classes.length > 0) {
            const classSelector = classes.map(c => `.${CSS.escape(c)}`).join('')
            if (isUnique(classSelector)) {
                return classSelector
            }

            // Try class with tag name
            const tagClassSelector = `${element.tagName.toLowerCase()}${classSelector}`
            if (isUnique(tagClassSelector)) {
                return tagClassSelector
            }
        }
    }

    // Strategy 3: Data attributes
    const dataAttrs = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'))

    for (const attr of dataAttrs) {
        const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`
        if (isUnique(selector)) {
            return selector
        }
    }

    // Strategy 4: Unique attribute combinations
    const uniqueAttrs = ['name', 'type', 'value', 'href', 'src']
    for (const attrName of uniqueAttrs) {
        const attrValue = element.getAttribute(attrName)
        if (attrValue) {
            const selector = `${element.tagName.toLowerCase()}[${attrName}="${CSS.escape(attrValue)}"]`
            if (isUnique(selector)) {
                return selector
            }
        }
    }

    // Strategy 5: nth-child with parent context
    return getNthChildSelector(element)
}

/**
 * Check if a selector is unique in the document
 * @param {string} selector - CSS selector to test
 * @returns {boolean} True if selector matches exactly one element
 */
function isUnique(selector) {
    try {
        return document.querySelectorAll(selector).length === 1
    } catch (e) {
        return false
    }
}

/**
 * Generate nth-child based selector with parent context
 * @param {HTMLElement} element - Target element
 * @returns {string} CSS selector
 */
function getNthChildSelector(element) {
    const path = []
    let current = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.tagName.toLowerCase()

        if (current.id) {
            // Stop at first parent with ID
            selector = `#${CSS.escape(current.id)}`
            path.unshift(selector)
            break
        }

        // Calculate nth-child index
        const parent = current.parentElement
        if (parent) {
            const siblings = Array.from(parent.children)
            const index = siblings.indexOf(current) + 1
            const totalOfType = siblings.filter(el => el.tagName === current.tagName).length

            // Use nth-of-type if there are multiple of the same tag
            if (totalOfType > 1) {
                const typeIndex = siblings
                    .filter(el => el.tagName === current.tagName)
                    .indexOf(current) + 1
                selector += `:nth-of-type(${typeIndex})`
            } else if (siblings.length > 1) {
                selector += `:nth-child(${index})`
            }
        }

        path.unshift(selector)

        // Stop at body or after 5 levels
        if (current.tagName === 'BODY' || path.length >= 5) {
            break
        }

        current = current.parentElement
    }

    return path.join(' > ')
}

/**
 * Verify that a selector still points to the same element
 * @param {string} selector - CSS selector
 * @param {HTMLElement} element - Expected element
 * @returns {boolean} True if selector matches the element
 */
window.ElementContextCapture.verifySelector = function verifySelector(selector, element) {
    try {
        const found = document.querySelector(selector)
        return found === element
    } catch (e) {
        return false
    }
}

/**
 * Get parent selector
 * @param {HTMLElement} element - Target element
 * @returns {string|null} Parent selector or null
 */
window.ElementContextCapture.getParentSelector = function getParentSelector(element) {
    const parent = element.parentElement
    if (!parent || parent.tagName === 'BODY') {
        return null
    }
    return window.ElementContextCapture.generateUniqueSelector(parent)
}
