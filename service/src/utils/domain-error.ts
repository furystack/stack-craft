/**
 * Base class for domain-specific errors in the service layer.
 * Carries an HTTP-friendly status code so REST actions can map
 * domain failures to the appropriate HTTP response without
 * inspecting error messages.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}
