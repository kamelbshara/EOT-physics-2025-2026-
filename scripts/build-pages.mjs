import { cpSync, mkdirSync, writeFileSync } from 'node:fs'

// PHYSICS_SAME_ORIGIN=1 (the Vercel build) serves the API from the same site under /api, so no origin is written.
// Otherwise (GitHub Pages) PHYSICS_API_ORIGIN names the HTTPS origin of the separate backend.
const sameOrigin = process.env.PHYSICS_SAME_ORIGIN === '1'
if (!sameOrigin && !process.env.PHYSICS_API_ORIGIN) {
  throw new Error('Set PHYSICS_API_ORIGIN to the HTTPS origin of the physics backend, or PHYSICS_SAME_ORIGIN=1.')
}
const url = sameOrigin ? null : new URL(process.env.PHYSICS_API_ORIGIN)
if (url && (url.protocol !== 'https:' || url.href !== url.origin + '/')) {
  throw new Error('PHYSICS_API_ORIGIN must be an HTTPS origin with no credentials, path or query.')
}
const root = new URL('../', import.meta.url)
const site = new URL('dist/pages/', root)
mkdirSync(site, { recursive: true })
cpSync(new URL('public/', root), site, { recursive: true })
writeFileSync(new URL('api-config.js', site), 'export const apiOrigin = ' + JSON.stringify(url ? url.origin : '') + '\n')
writeFileSync(new URL('.nojekyll', site), '')
