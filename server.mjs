import { StringDecoder } from 'node:string_decoder'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { physicsApi } from './physics.mjs'
import { readdirSync } from 'node:fs'
import { extname } from 'node:path'

const data = new URL('./data/', import.meta.url)
mkdirSync(data, { recursive: true })
const db = new DatabaseSync(process.env.PHYSICS_DB || new URL('practice.sqlite', data))
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;')
const assets = new Map([
  ['/', ['index.html', 'text/html']],
])
const physics = physicsApi(db)
const mime = {'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml'}
for (const name of readdirSync(new URL('./public/', import.meta.url),{recursive:true})) {
  if (mime[extname(name)]) assets.set('/'+name,[name,mime[extname(name)]])
}
async function jsonBody(request) {
  const decoder = new StringDecoder('utf8')
  let body = ''
  for await (const chunk of request) {
    body += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    if (body.length > 8192) throw new Error('Body is too large')
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
    if (request.method === 'GET' && assets.has(path)) {
      const [name, type] = assets.get(path)
      response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' })
      return response.end(readFileSync(new URL('./public/' + name, import.meta.url)))
    }
    let student = request.headers.cookie?.match(/(?:^|; *)physics_student=([a-f0-9-]{36})(?:;|$)/)?.[1]
    if (!student) {
      student = randomUUID()
      response.setHeader('Set-Cookie', `physics_student=${student}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${request.headers['x-forwarded-proto'] === 'https' || request.socket.encrypted ? '; Secure' : ''}`)
    }
    if (/^\/api\/(catalog|profile|progress|card|figure|record|mock)(?:\/|$)/.test(path)) {
      return await physics(path,request,response,student,reply,jsonBody)
    }
    return reply(404, { error: 'غير متاح' })
  } catch (error) {
    console.error(error)
    reply(500, { error: 'Could not complete the request. Try again.' })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  createServer(handleRequest).listen(Number(process.env.PORT || 3000), '0.0.0.0')
}
