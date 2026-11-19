import { cpSync, mkdirSync, writeFileSync } from 'node:fs'

if (!process.env.PHYSICS_API_ORIGIN) {
  throw new Error('Set PHYSICS_API_ORIGIN to the HTTPS origin of the physics backend.')
}
const url = new URL(process.env.PHYSICS_API_ORIGIN)
if (url.protocol !== 'https:' || url.href !== url.origin + '/') {
  throw new Error('PHYSICS_API_ORIGIN must be an HTTPS origin with no credentials, path or query.')
}
const root = new URL('../', import.meta.url)
const site = new URL('dist/pages/', root)
mkdirSync(site, { recursive: true })
cpSync(new URL('public/', root), site, { recursive: true })
writeFileSync(new URL('api-config.js', site), 'export const apiOrigin = ' + JSON.stringify(url.origin) + '\n')
writeFileSync(new URL('.nojekyll', site), '')
