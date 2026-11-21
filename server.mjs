import { StringDecoder } from 'node:string_decoder'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { physicsApi } from './physics.mjs'
import { readdirSync } from 'node:fs'
import { extname, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scheduleBackups } from './lib/backup.mjs'

const data = new URL('./data/', import.meta.url)
mkdirSync(data, { recursive: true })
const db = new DatabaseSync(process.env.PHYSICS_DB || new URL('practice.sqlite', data))
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;')
const assets = new Map([
  ['/', ['index.html', 'text/html']],
])
const physics = physicsApi(db)
// Frontends allowed to call this API from another origin: GitHub Pages and the Vercel copy, plus any listed in
// PHYSICS_PAGES_ORIGIN (comma-separated). Every frontend shares this one server and database.
const allowedOrigins = new Set(['https://kamelbshara.github.io', 'https://haykal100.vercel.app',
  ...(process.env.PHYSICS_PAGES_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)])
const mime = {'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml'}
for (const name of readdirSync(new URL('./public/', import.meta.url),{recursive:true})) {
  if (mime[extname(name)]) assets.set('/'+name,[name,mime[extname(name)]])
}
async function jsonBody(request) {
  // notebook pages carry handwriting strokes; every other request stays small
  const limit = /^\/api\/(?:notebook|admin\/notebook|ask|admin\/rubric)/.test(request.url || '') ? 3_000_000 : 8192
  const decoder = new StringDecoder('utf8')
  let body = ''
  for await (const chunk of request) {
    body += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    if (body.length > limit) throw new Error('Body is too large')
  }
  return JSON.parse(body + decoder.end())
}

export async function handleRequest(request, response) {
  const reply = (status, payload) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(payload))
  }
  response.setHeader('X-Content-Type-Options','nosniff')
  response.setHeader('Referrer-Policy','same-origin')
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'none'")
  try {
    const path = new URL(request.url, 'http://localhost').pathname
    if ((request.method === 'GET' || request.method === 'HEAD') && assets.has(path)) {
      const [name, type] = assets.get(path)
      const file = readFileSync(new URL('./public/' + name, import.meta.url))
      response.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Content-Length': file.length })
      return response.end(request.method === 'HEAD' ? undefined : file)
    }
    const origin = request.headers.origin
    const fromPages = Boolean(origin && allowedOrigins.has(origin))
    if (path.startsWith('/api/')) {
      response.setHeader('Vary', 'Origin')
      if (fromPages) {
        response.setHeader('Access-Control-Allow-Origin', origin)
        response.setHeader('Access-Control-Allow-Credentials', 'true')
        if (request.method === 'OPTIONS') {
          response.writeHead(204, {
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          return response.end()
        }
      } else if (origin && new URL(origin).host !== request.headers.host) {
        return reply(403, { error: 'Origin is not allowed' })
      }
    }
    const policy = fromPages ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax' + (request.headers['x-forwarded-proto'] === 'https' || request.socket.encrypted ? '; Secure' : '')
    const cookies = []
    const setCookie = (name, value, maxAge) => {
      cookies.push(`${name}=${value}; Path=/; HttpOnly; ${policy}; Max-Age=${maxAge}`)
      response.setHeader('Set-Cookie', cookies)
    }
    let student = request.headers.cookie?.match(/(?:^|; *)physics_student=([a-f0-9-]{36})(?:;|$)/)?.[1]
    if (!student) {
      student = randomUUID()
      setCookie('physics_student', student, 31536000)
    }
    const teacher = request.headers.cookie?.match(/(?:^|; *)physics_teacher=([a-f0-9]{64})(?:;|$)/)?.[1] || null
    const session = { teacher, setCookie, assignStudent: id => setCookie('physics_student', id, 31536000) }
    if (/^\/api\/(catalog|profile|progress|card|figure|record|walkthrough|mock|login|logout|notebook|tests|insights|ask|admin|leaderboard|hints)(?:\/|$)/.test(path)) {
      return await physics(path,request,response,student,reply,jsonBody,session)
    }
    return reply(404, { error: 'غير متاح' })
  } catch (error) {
    console.error(error)
    reply(500, { error: 'Could not complete the request. Try again.' })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  createServer(handleRequest).listen(Number(process.env.PORT || 3000), '0.0.0.0')
  // daily backups beside the database unless PHYSICS_BACKUP_DIR says otherwise; PHYSICS_BACKUP_HOURS=0 turns them off
  const dbFile = process.env.PHYSICS_DB || fileURLToPath(new URL('practice.sqlite', data))
  const hours = Number(process.env.PHYSICS_BACKUP_HOURS ?? 24)
  if (hours > 0) scheduleBackups(db, process.env.PHYSICS_BACKUP_DIR || join(dirname(dbFile), 'backups'), hours)
}
