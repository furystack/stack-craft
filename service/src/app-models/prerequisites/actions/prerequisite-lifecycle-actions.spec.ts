import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { Prerequisite, PrerequisiteCheckResult } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatePrerequisiteAction, DeletePrerequisiteAction } from './prerequisite-lifecycle-actions.js'

vi.mock('@furystack/rest-service', async () => {
  const actual: Record<string, unknown> = await vi.importActual('@furystack/rest-service')
  return {
    ...actual,
    readPostBody: vi.fn(),
  }
})

import { readPostBody } from '@furystack/rest-service'

const mockedReadPostBody = readPostBody as ReturnType<typeof vi.fn>

describe('CreatePrerequisiteAction', () => {
  let injector: Injector
  let elevated: Injector
  let prereqStore: InMemoryStore<Prerequisite, 'id'>
  let checkResultStore: InMemoryStore<PrerequisiteCheckResult, 'prerequisiteId'>

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })
    addStore(injector, prereqStore)
    getRepository(injector).createDataSet(Prerequisite, 'id', {})

    checkResultStore = new InMemoryStore({ model: PrerequisiteCheckResult, primaryKey: 'prerequisiteId' })
    addStore(injector, checkResultStore)
    getRepository(injector).createDataSet(PrerequisiteCheckResult, 'prerequisiteId', {})

    elevated = useSystemIdentityContext({ injector })
  })

  afterEach(async () => {
    await elevated[Symbol.asyncDispose]()
    await injector[Symbol.asyncDispose]()
  })

  it('should create a prerequisite and seed an unchecked check result', async () => {
    const body = {
      id: 'prereq-1',
      stackName: 'my-stack',
      name: 'Node.js >= 18',
      type: 'custom-script' as const,
      config: { script: 'node -v' },
      installationHelp: 'Install Node.js',
    }

    mockedReadPostBody.mockResolvedValue(body)

    const result = await CreatePrerequisiteAction({
      injector: elevated,
      request: {} as never,
      getBody: vi.fn() as never,
      response: {} as never,
    })

    expect(result.statusCode).toBe(201)

    const storedPrereqs = await prereqStore.find({})
    expect(storedPrereqs).toHaveLength(1)
    expect(storedPrereqs[0].name).toBe('Node.js >= 18')

    const checkResults = await checkResultStore.find({})
    expect(checkResults).toHaveLength(1)
    expect(checkResults[0].prerequisiteId).toBe('prereq-1')
    expect(checkResults[0].status).toBe('unchecked')
  })

  it('should throw 500 when prerequisite creation returns empty', async () => {
    mockedReadPostBody.mockResolvedValue({
      id: 'prereq-2',
      stackName: 'my-stack',
      name: 'Docker',
      type: 'custom-script' as const,
      config: { script: 'docker -v' },
      installationHelp: 'Install Docker',
    })

    const ds = getRepository(elevated).getDataSetFor(Prerequisite, 'id')
    const originalAdd = ds.add.bind(ds)
    vi.spyOn(ds, 'add').mockImplementation(async (...args) => {
      await originalAdd(...args)
      return { created: [] }
    })

    await expect(
      CreatePrerequisiteAction({
        injector: elevated,
        request: {} as never,
        getBody: vi.fn() as never,
        response: {} as never,
      }),
    ).rejects.toThrow('Prerequisite not created')
  })
})

describe('DeletePrerequisiteAction', () => {
  let injector: Injector
  let elevated: Injector
  let prereqStore: InMemoryStore<Prerequisite, 'id'>
  let checkResultStore: InMemoryStore<PrerequisiteCheckResult, 'prerequisiteId'>

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })
    addStore(injector, prereqStore)
    getRepository(injector).createDataSet(Prerequisite, 'id', {})

    checkResultStore = new InMemoryStore({ model: PrerequisiteCheckResult, primaryKey: 'prerequisiteId' })
    addStore(injector, checkResultStore)
    getRepository(injector).createDataSet(PrerequisiteCheckResult, 'prerequisiteId', {})

    elevated = useSystemIdentityContext({ injector })
  })

  afterEach(async () => {
    await elevated[Symbol.asyncDispose]()
    await injector[Symbol.asyncDispose]()
  })

  it('should delete prerequisite and its check result', async () => {
    const ts = new Date().toISOString()
    await prereqStore.add({
      id: 'prereq-del',
      stackName: 'stack',
      name: 'Node',
      type: 'custom-script',
      config: { script: 'node -v' },
      installationHelp: '',
      createdAt: ts,
      updatedAt: ts,
    } as Prerequisite)

    await checkResultStore.add({
      prerequisiteId: 'prereq-del',
      status: 'satisfied',
      output: 'v20.0.0',
      checkedAt: ts,
    })

    const result = await DeletePrerequisiteAction({
      injector: elevated,
      getUrlParams: () => ({ id: 'prereq-del' }),
      request: {} as never,
      response: {} as never,
    })

    expect(result.statusCode).toBe(204)

    const remainingPrereqs = await prereqStore.find({})
    expect(remainingPrereqs).toHaveLength(0)

    const remainingResults = await checkResultStore.find({})
    expect(remainingResults).toHaveLength(0)
  })

  it('should delete prerequisite even when no check result exists', async () => {
    const ts = new Date().toISOString()
    await prereqStore.add({
      id: 'prereq-no-result',
      stackName: 'stack',
      name: 'Docker',
      type: 'custom-script',
      config: { script: 'docker -v' },
      installationHelp: '',
      createdAt: ts,
      updatedAt: ts,
    } as Prerequisite)

    const result = await DeletePrerequisiteAction({
      injector: elevated,
      getUrlParams: () => ({ id: 'prereq-no-result' }),
      request: {} as never,
      response: {} as never,
    })

    expect(result.statusCode).toBe(204)

    const remainingPrereqs = await prereqStore.find({})
    expect(remainingPrereqs).toHaveLength(0)
  })
})
