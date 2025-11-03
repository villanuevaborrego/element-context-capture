#!/usr/bin/env node

/**
 * Smart server starter - ensures only one instance runs
 */

import { exec } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const LOCKFILE = join(__dirname, '..', '.server.lock')
const PORT = 38100

/**
 * Check if a process is running
 */
async function isProcessRunning(pid) {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

/**
 * Check if server is already running
 */
async function checkExistingServer() {
    if (!existsSync(LOCKFILE)) {
        return null
    }

    try {
        const data = JSON.parse(readFileSync(LOCKFILE, 'utf-8'))
        const isRunning = await isProcessRunning(data.pid)

        if (isRunning) {
            // Check if port is actually in use
            try {
                await execAsync(`lsof -ti:${PORT}`)
                console.error(`[Shared Server] Already running (PID: ${data.pid})`)
                return data
            } catch {
                // Port not in use, clean up stale lockfile
                unlinkSync(LOCKFILE)
                return null
            }
        } else {
            // Process not running, clean up stale lockfile
            unlinkSync(LOCKFILE)
            return null
        }
    } catch (error) {
        // Invalid lockfile, remove it
        unlinkSync(LOCKFILE)
        return null
    }
}

/**
 * Start the MCP server
 */
async function startServer() {
    const existing = await checkExistingServer()

    if (existing) {
        // Server already running, just connect to it
        console.error('[Shared Server] Connecting to existing server')
        process.exit(0)
    }

    // Write lockfile
    writeFileSync(LOCKFILE, JSON.stringify({
        pid: process.pid,
        startedAt: Date.now()
    }))

    // Clean up lockfile on exit
    process.on('exit', () => {
        try {
            unlinkSync(LOCKFILE)
        } catch {}
    })

    process.on('SIGINT', () => {
        process.exit(0)
    })

    process.on('SIGTERM', () => {
        process.exit(0)
    })

    // Start the actual server
    console.error('[Shared Server] Starting new server instance')
    const { main } = await import('./index.js')
    await main()
}

startServer()
