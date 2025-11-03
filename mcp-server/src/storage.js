/**
 * Element storage manager with TTL support
 */

import { sanitizeElement, validateCapturedElement } from './schema.js'

export class ElementStorage {
    constructor(options = {}) {
        this.elements = new Map()
        this.maxElements = options.maxElements || 50
        this.ttl = options.ttl || 3600000 // 1 hour in milliseconds
        this.cleanupInterval = options.cleanupInterval || 300000 // 5 minutes

        // Start cleanup timer
        this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval)
    }

    /**
     * Add an element to storage
     * @param {import('./schema.js').CapturedElement} element - Element to store
     * @returns {boolean} Success status
     */
    add(element) {
        if (!validateCapturedElement(element)) {
            console.error('Invalid element data', element)
            return false
        }

        const sanitized = sanitizeElement(element)

        // Enforce max elements limit (FIFO)
        if (this.elements.size >= this.maxElements) {
            const oldestId = this.elements.keys().next().value
            this.elements.delete(oldestId)
            console.log(`Removed oldest element ${oldestId} to maintain size limit`)
        }

        this.elements.set(sanitized.id, {
            data: sanitized,
            expiresAt: Date.now() + this.ttl
        })

        console.log(`Added element ${sanitized.id} (${sanitized.selector})`)
        return true
    }

    /**
     * Get an element by ID
     * @param {string} id - Element ID
     * @returns {import('./schema.js').CapturedElement|null} Element or null if not found/expired
     */
    get(id) {
        const entry = this.elements.get(id)
        if (!entry) return null

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.elements.delete(id)
            return null
        }

        return entry.data
    }

    /**
     * Get all non-expired elements
     * @returns {import('./schema.js').CapturedElement[]} Array of elements
     */
    getAll() {
        const now = Date.now()
        const validElements = []

        for (const [id, entry] of this.elements.entries()) {
            if (now > entry.expiresAt) {
                this.elements.delete(id)
            } else {
                validElements.push(entry.data)
            }
        }

        // Sort by timestamp (newest first)
        return validElements.sort((a, b) => b.timestamp - a.timestamp)
    }

    /**
     * Remove an element by ID
     * @param {string} id - Element ID
     * @returns {boolean} True if removed, false if not found
     */
    remove(id) {
        const deleted = this.elements.delete(id)
        if (deleted) {
            console.log(`Removed element ${id}`)
        }
        return deleted
    }

    /**
     * Clear all elements
     */
    clear() {
        const count = this.elements.size
        this.elements.clear()
        console.log(`Cleared ${count} elements from storage`)
    }

    /**
     * Search elements by query (selector or text content)
     * @param {string} query - Search query
     * @returns {import('./schema.js').CapturedElement[]} Matching elements
     */
    search(query) {
        const lowerQuery = query.toLowerCase()
        const allElements = this.getAll()

        return allElements.filter(element => {
            return (
                element.selector.toLowerCase().includes(lowerQuery) ||
                element.text.toLowerCase().includes(lowerQuery) ||
                element.html.toLowerCase().includes(lowerQuery) ||
                element.url.toLowerCase().includes(lowerQuery)
            )
        })
    }

    /**
     * Get storage statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const elements = this.getAll()
        return {
            total: elements.length,
            maxElements: this.maxElements,
            ttl: this.ttl,
            oldestTimestamp: elements.length > 0 ? Math.min(...elements.map(e => e.timestamp)) : null,
            newestTimestamp: elements.length > 0 ? Math.max(...elements.map(e => e.timestamp)) : null
        }
    }

    /**
     * Cleanup expired elements
     */
    cleanup() {
        const now = Date.now()
        let removed = 0

        for (const [id, entry] of this.elements.entries()) {
            if (now > entry.expiresAt) {
                this.elements.delete(id)
                removed++
            }
        }

        if (removed > 0) {
            console.log(`Cleanup: removed ${removed} expired elements`)
        }
    }

    /**
     * Destroy storage and cleanup timer
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer)
            this.cleanupTimer = null
        }
        this.clear()
    }
}
