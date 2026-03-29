import { describe, expect, it } from 'vitest'

import { ConflictError, DomainError, NotFoundError, ValidationError } from './domain-error.js'

describe('DomainError', () => {
  it('should default to status code 500', () => {
    const error = new DomainError('something went wrong')
    expect(error.message).toBe('something went wrong')
    expect(error.statusCode).toBe(500)
    expect(error.name).toBe('DomainError')
    expect(error).toBeInstanceOf(Error)
  })

  it('should accept a custom status code', () => {
    const error = new DomainError('teapot', 418)
    expect(error.statusCode).toBe(418)
  })
})

describe('NotFoundError', () => {
  it('should have status code 404', () => {
    const error = new NotFoundError('not found')
    expect(error.statusCode).toBe(404)
    expect(error.name).toBe('NotFoundError')
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('ConflictError', () => {
  it('should have status code 409', () => {
    const error = new ConflictError('conflict')
    expect(error.statusCode).toBe(409)
    expect(error.name).toBe('ConflictError')
    expect(error).toBeInstanceOf(DomainError)
  })
})

describe('ValidationError', () => {
  it('should have status code 400', () => {
    const error = new ValidationError('bad input')
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe('ValidationError')
    expect(error).toBeInstanceOf(DomainError)
  })
})
