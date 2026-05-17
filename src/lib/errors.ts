/**
 * A typed error for HTTP failures.
 * I made this so I can distinguish "the server said 401" from
 * "the network just died" — both throw, but they need different UI messages.
 */
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
