import { env } from '@repo/env'
import { serveStatic } from 'hono/bun'
import { app, frontEndPath } from './app'

app.all(
  '/assets/*',
  serveStatic({
    root: frontEndPath
  })
)

app.all(
  '*',
  serveStatic({
    root: frontEndPath,
    path: 'index.html'
  })
)

export default {
  port: env.PORT,
  fetch: app.fetch
}
