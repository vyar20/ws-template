import { getRequestListener } from '@hono/node-server'
import { env } from '@repo/env'
import { HTTPCode, HTTPText } from '@repo/utils'
import { createServer } from 'node:http'
import { app, vite } from './app'

const honoHandler = getRequestListener(app.fetch)

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api')) return honoHandler(req, res)

  vite.middlewares(req, res, () => {
    res.statusCode = HTTPCode.NOT_FOUND
    res.end(HTTPText.NOT_FOUND)
  })
})

server.listen(env.PORT, () =>
  console.log(`Server running on port: http://localhost:${env.PORT}`)
)
