import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceDefinition } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DomainError } from './domain-error.js'
import { getServiceOrThrow } from './get-service-or-throw.js'

const ts = new Date().toISOString()

const makeServiceDefinition = (
  overrides: Partial<ServiceDefinition> & { id: string; stackName: string },
): ServiceDefinition =>
  ({
    displayName: overrides.id,
    description: '',
    runCommand: 'echo test',
    prerequisiteIds: [],
    prerequisiteServiceIds: [],
    files: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }) as ServiceDefinition

describe('getServiceOrThrow', () => {
  let injector: Injector

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    const svcDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
    addStore(injector, svcDefStore)
    getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  it('returns the service when found', async () => {
    const elevated = useSystemIdentityContext({ injector })
    try {
      const svcDef = makeServiceDefinition({ id: 'svc-found', stackName: 'stack-a' })
      await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').add(elevated, svcDef)

      const result = await getServiceOrThrow('svc-found', elevated)
      expect(result).toEqual(svcDef)
    } finally {
      await elevated[Symbol.asyncDispose]()
    }
  })

  it('throws DomainError with status 404 when not found', async () => {
    const elevated = useSystemIdentityContext({ injector })
    try {
      await expect(getServiceOrThrow('nonexistent', elevated)).rejects.toSatisfy(
        (err: unknown): err is DomainError =>
          err instanceof DomainError && err.statusCode === 404 && err.message === 'Service not found: nonexistent',
      )
    } finally {
      await elevated[Symbol.asyncDispose]()
    }
  })

  it('works with the elevated injector', async () => {
    const elevated = useSystemIdentityContext({ injector })
    try {
      await getRepository(elevated)
        .getDataSetFor(ServiceDefinition, 'id')
        .add(elevated, makeServiceDefinition({ id: 'svc-a', stackName: 'stack-x' }))
      await getRepository(elevated)
        .getDataSetFor(ServiceDefinition, 'id')
        .add(elevated, makeServiceDefinition({ id: 'svc-b', stackName: 'stack-x' }))

      const result = await getServiceOrThrow('svc-b', elevated)
      expect(result.id).toBe('svc-b')
    } finally {
      await elevated[Symbol.asyncDispose]()
    }
  })
})
