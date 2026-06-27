import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const app = new Hono()

// Color utilities for terminal log styling
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
}

function logInfo(message: string) {
  console.log(`${colors.cyan}[INFO] [${new Date().toISOString()}] ${message}${colors.reset}`)
}

function logWarn(message: string) {
  console.warn(`${colors.yellow}[WARN] [${new Date().toISOString()}] ⚠️ ${message}${colors.reset}`)
}

function logSuccess(message: string) {
  console.log(`${colors.green}[SUCCESS] [${new Date().toISOString()}] ✅ ${message}${colors.reset}`)
}

function logError(message: string) {
  console.error(`${colors.red}[ERROR] [${new Date().toISOString()}] ❌ ${message}${colors.reset}`)
}

// Normalize Zalo payment notification data payload
function normalizeZaloNotifyData(data: any): { appId: string; orderId: string; method: string } {
  if (typeof data === 'string') {
    try {
      return normalizeZaloNotifyData(JSON.parse(data))
    } catch {
      return { appId: '', orderId: '', method: '' }
    }
  }
  if (!data || typeof data !== 'object') {
    return { appId: '', orderId: '', method: '' }
  }
  const payload = data as Record<string, unknown>
  return {
    appId: String(payload.appId ?? '').trim(),
    orderId: String(payload.orderId ?? '').trim(),
    method: String(payload.method ?? '').trim()
  }
}

// Verify MAC signature from webhook body
function verifyZaloNotifyMac(
  data: { appId: string; orderId: string; method: string },
  mac: string,
  privateKey: string
): boolean {
  const dataMac = `appId=${data.appId}&orderId=${data.orderId}&method=${data.method}`
  const expected = crypto.createHmac('sha256', privateKey).update(dataMac).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(mac)
  
  logInfo(`Verifying MAC:`)
  logInfo(`  - Data MAC String: "${dataMac}"`)
  logInfo(`  - Expected Signature: "${expected}"`)
  logInfo(`  - Provided Signature: "${mac}"`)

  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

// Root status endpoint
app.get('/', (c) => {
  return c.json({
    status: 'online',
    service: 'Zalo Payment Notify Test API',
    timestamp: new Date().toISOString()
  })
})

/**
 * Webhook handler replicating `handleZaloPaymentNotify` from midomaxZNS-system.
 * Expects JSON payload:
 * {
 *   "data": { "appId": "...", "orderId": "...", "method": "..." } or stringified JSON,
 *   "mac": "..."
 * }
 */
app.post('/payment/notify', async (c) => {
  let body: any
  try {
    body = await c.req.json()
  } catch (err: any) {
    logError(`Failed to parse request JSON: ${err.message}`)
    return c.json({ returnCode: -1, returnMessage: 'Invalid JSON payload' }, 400)
  }

  logInfo(`Received Zalo payment notify payload: ${JSON.stringify(body)}`)

  const data = normalizeZaloNotifyData(body.data)
  const mac = String(body.mac ?? '').trim()

  if (!data.appId || !data.orderId || !data.method || !mac) {
    logWarn(
      `Zalo payment notify rejected: invalid payload appId=${data.appId || '-'} orderId=${data.orderId || '-'} method=${data.method || '-'} hasMac=${Boolean(mac)}`
    )
    return c.json({ returnCode: -1, returnMessage: 'Invalid notify payload' }, 400)
  }

  const privateKey = process.env.ZALO_MINIAPP_CHECKOUT_PRIVATE_KEY
  if (!privateKey) {
    logError('Server Error: ZALO_MINIAPP_CHECKOUT_PRIVATE_KEY is not defined in the environment!')
    return c.json({ returnCode: -1, returnMessage: 'Server configuration error' }, 500)
  }

  if (!verifyZaloNotifyMac(data, mac, privateKey)) {
    logWarn(`Zalo payment notify rejected: invalid mac appId=${data.appId} orderId=${data.orderId} method=${data.method}`)
    return c.json({ returnCode: -1, returnMessage: 'Invalid mac' }, 400)
  }

  const method = data.method.trim().toUpperCase()
  logSuccess(`Zalo payment notify matched and verified successfully!`)
  logSuccess(`  - App ID: ${data.appId}`)
  logSuccess(`  - Order ID: ${data.orderId}`)
  logSuccess(`  - Method: ${method}`)

  return c.json({ returnCode: 1, returnMessage: 'success' })
})

/**
 * Utility helper endpoint to sign payload.
 * Useful for local manual testing.
 * Expects JSON payload:
 * {
 *   "appId": "...",
 *   "orderId": "...",
 *   "method": "..."
 * }
 */
app.post('/payment/mock-sign', async (c) => {
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const appId = String(body.appId ?? '').trim()
  const orderId = String(body.orderId ?? '').trim()
  const method = String(body.method ?? '').trim()

  if (!appId || !orderId || !method) {
    return c.json({ error: 'appId, orderId, and method are required' }, 400)
  }

  const privateKey = process.env.ZALO_MINIAPP_CHECKOUT_PRIVATE_KEY
  if (!privateKey) {
    return c.json({ error: 'Server private key missing' }, 500)
  }

  const dataMac = `appId=${appId}&orderId=${orderId}&method=${method}`
  const mac = crypto.createHmac('sha256', privateKey).update(dataMac).digest('hex')

  const signedPayload = {
    data: { appId, orderId, method },
    mac
  }

  logInfo(`Generated mock payload sign: ${JSON.stringify(signedPayload)}`)

  return c.json(signedPayload)
})

const port = Number(process.env.PORT || 3000)
logInfo(`Starting Zalo Payment Notify Test server on port ${port}...`)
serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0'
})


