export const fetcher = async <T>(
  url: string,
  options?: RequestInit & {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body: Object
  }
) => {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    method: options?.method ?? 'GET',
    body: options?.body ? JSON.stringify(options.body) : undefined
  })

  const contentType = res.headers.get('content-type')
  const isJson = contentType?.includes('application/json')
  const isText = contentType?.includes('text')
  const body = isJson
    ? await res.json()
    : isText
      ? await res.text()
      : res.statusText

  if (!res.ok) throw new Error((body as { message: string })?.message ?? body)

  return body as T
}

export const p = <T>(promise: Promise<T>): Promise<[null, T] | [Error]> =>
  promise.then((data) => [null, data] as [null, T]).catch((err) => [err])

export class ErrorHandler extends Error {
  message: string
  reason: unknown
  constructor(message: string, reason?: unknown) {
    super()
    this.message = message
    this.reason = reason
  }
}

export enum HTTPText {
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  OK = 'OK',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND'
}

export enum HTTPCode {
  BAD_REQUEST = 400,
  INTERNAL_SERVER_ERROR = 500,
  OK = 200,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404
}
