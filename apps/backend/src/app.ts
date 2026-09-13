import { env } from '@repo/env'
import { Hono } from 'hono'
import path from 'path'
import { createServer as createViteServer } from 'vite'

export const app = new Hono()
export const frontEndPath = path.resolve(
  env.NODE_ENV === 'development'
    ? `${import.meta.dirname}/../../frontend`
    : `${import.meta.dirname}/../../frontend/dist`
)

export const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
  root: frontEndPath
})

app.get('/api', (c) => c.json({ message: 'success' }))
