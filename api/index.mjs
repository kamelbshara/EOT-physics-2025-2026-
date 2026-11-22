// Vercel Function: the whole physics API (every /api/* path is rewritten here by vercel.json).
// It runs the same handler as server.mjs, against Neon Postgres through DATABASE_URL.
import { handleRequest } from '../server.mjs'

export default function handler(request, response) {
  return handleRequest(request, response)
}
