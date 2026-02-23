import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { Prerequisite, StackConfig } from 'common'
import type { PrerequisiteConfig, PrerequisiteType } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runCheck, CheckPrerequisiteAction } from './check-prerequisite-action.js'

const execFileMock = vi.hoisted(() =>
  vi.fn<(cmd: string, args: string[], options: { timeout: number }) => Promise<{ stdout: string; stderr: string }>>(),
)

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...(args as [string, string[], { timeout: number }])),
}))

vi.mock('util', () => ({
  promisify: () => execFileMock,
}))

const createMockActionContext = (options: { injector: Injector; urlParams?: Record<string, string> }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(undefined as never),
  getUrlParams: () => (options.urlParams ?? {}) as never,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

describe('CheckPrerequisiteAction', () => {
  let injector: Injector
  let prereqStore: InMemoryStore<Prerequisite, 'id'>
  let stackConfigStore: InMemoryStore<StackConfig, 'stackName'>

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })
    addStore(injector, prereqStore)
    getRepository(injector).createDataSet(Prerequisite, 'id', {})

    stackConfigStore = new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' })
    addStore(injector, stackConfigStore)
    getRepository(injector).createDataSet(StackConfig, 'stackName', {})

    vi.clearAllMocks()
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  describe('runCheck', () => {
    describe('node', () => {
      it('should return satisfied when version meets minimum', async () => {
        execFileMock.mockResolvedValue({ stdout: 'v20.11.0\n', stderr: '' })
        const result = await runCheck('node', { minimumVersion: '18.0.0' })
        expect(result.satisfied).toBe(true)
        expect(result.output).toContain('20.11.0')
      })

      it('should return not satisfied when version is below minimum', async () => {
        execFileMock.mockResolvedValue({ stdout: 'v16.20.0\n', stderr: '' })
        const result = await runCheck('node', { minimumVersion: '18.0.0' })
        expect(result.satisfied).toBe(false)
      })

      it('should return not satisfied when version cannot be parsed', async () => {
        execFileMock.mockResolvedValue({ stdout: 'unknown\n', stderr: '' })
        const result = await runCheck('node', { minimumVersion: '18.0.0' })
        expect(result.satisfied).toBe(false)
        expect(result.output).toContain('Could not parse')
      })
    })

    describe('yarn', () => {
      it('should return satisfied when version meets minimum', async () => {
        execFileMock.mockResolvedValue({ stdout: '4.6.0\n', stderr: '' })
        const result = await runCheck('yarn', { minimumVersion: '4.0.0' })
        expect(result.satisfied).toBe(true)
      })

      it('should return not satisfied when version is below minimum', async () => {
        execFileMock.mockResolvedValue({ stdout: '1.22.0\n', stderr: '' })
        const result = await runCheck('yarn', { minimumVersion: '4.0.0' })
        expect(result.satisfied).toBe(false)
      })
    })

    describe('git', () => {
      it('should return satisfied when git is available', async () => {
        execFileMock.mockResolvedValue({ stdout: 'git version 2.43.0\n', stderr: '' })
        const result = await runCheck('git', {} as PrerequisiteConfig)
        expect(result.satisfied).toBe(true)
        expect(result.output).toContain('git version')
      })
    })

    describe('env-variable', () => {
      it('should return satisfied when env var is set', async () => {
        const originalEnv = process.env.TEST_CHECK_VAR
        process.env.TEST_CHECK_VAR = 'some-value'
        try {
          const result = await runCheck('env-variable', { variableName: 'TEST_CHECK_VAR' })
          expect(result.satisfied).toBe(true)
        } finally {
          if (originalEnv === undefined) {
            delete process.env.TEST_CHECK_VAR
          } else {
            process.env.TEST_CHECK_VAR = originalEnv
          }
        }
      })

      it('should return not satisfied when env var is not set', async () => {
        delete process.env.DEFINITELY_NOT_SET_VAR_12345
        const result = await runCheck('env-variable', { variableName: 'DEFINITELY_NOT_SET_VAR_12345' })
        expect(result.satisfied).toBe(false)
      })

      it('should return satisfied when configured as custom with value', async () => {
        delete process.env.CUSTOM_ONLY_VAR_12345
        const result = await runCheck(
          'env-variable',
          { variableName: 'CUSTOM_ONLY_VAR_12345' },
          {
            envVarConfig: { source: 'custom', customValue: 'my-secret' },
          },
        )
        expect(result.satisfied).toBe(true)
        expect(result.output).toContain('custom value')
      })

      it('should return satisfied when configured as inherit and globally available', async () => {
        const originalEnv = process.env.INHERIT_VAR_12345
        process.env.INHERIT_VAR_12345 = 'global-value'
        try {
          const result = await runCheck(
            'env-variable',
            { variableName: 'INHERIT_VAR_12345' },
            {
              envVarConfig: { source: 'inherit' },
            },
          )
          expect(result.satisfied).toBe(true)
          expect(result.output).toContain('inherited')
        } finally {
          if (originalEnv === undefined) {
            delete process.env.INHERIT_VAR_12345
          } else {
            process.env.INHERIT_VAR_12345 = originalEnv
          }
        }
      })

      it('should return not satisfied when configured as inherit but not globally available', async () => {
        delete process.env.MISSING_INHERIT_VAR_12345
        const result = await runCheck(
          'env-variable',
          { variableName: 'MISSING_INHERIT_VAR_12345' },
          {
            envVarConfig: { source: 'inherit' },
          },
        )
        expect(result.satisfied).toBe(false)
      })
    })

    describe('custom-script', () => {
      it('should return satisfied when script succeeds', async () => {
        execFileMock.mockResolvedValue({ stdout: 'OK\n', stderr: '' })
        const result = await runCheck('custom-script', { script: 'echo OK' })
        expect(result.satisfied).toBe(true)
        expect(result.output).toBe('OK')
      })
    })

    describe('dotnet-sdk', () => {
      it('should return satisfied when SDK version is installed', async () => {
        execFileMock.mockResolvedValue({
          stdout: '8.0.100 [/usr/share/dotnet/sdk]\n9.0.100 [/usr/share/dotnet/sdk]\n',
          stderr: '',
        })
        const result = await runCheck('dotnet-sdk', { version: '8.0.100' })
        expect(result.satisfied).toBe(true)
      })

      it('should return not satisfied when SDK version is not installed', async () => {
        execFileMock.mockResolvedValue({
          stdout: '8.0.100 [/usr/share/dotnet/sdk]\n',
          stderr: '',
        })
        const result = await runCheck('dotnet-sdk', { version: '9.0.100' })
        expect(result.satisfied).toBe(false)
      })
    })

    describe('unknown type', () => {
      it('should return not satisfied for unknown type', async () => {
        const result = await runCheck('unknown-type' as PrerequisiteType, {} as PrerequisiteConfig)
        expect(result.satisfied).toBe(false)
        expect(result.output).toContain('Unknown prerequisite type')
      })
    })
  })

  describe('CheckPrerequisiteAction handler', () => {
    it('should return check result for existing prerequisite', async () => {
      const ts = new Date().toISOString()
      await prereqStore.add({
        id: 'prereq-1',
        stackName: 'test-stack',
        name: 'Node.js',
        type: 'node',
        config: { minimumVersion: '18.0.0' },
        installationHelp: 'Install Node.js',
        createdAt: ts,
        updatedAt: ts,
      })

      execFileMock.mockResolvedValue({ stdout: 'v20.11.0\n', stderr: '' })

      const elevated = useSystemIdentityContext({ injector })
      const result = await CheckPrerequisiteAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'prereq-1' } }),
      )
      await elevated[Symbol.asyncDispose]()

      const body = result.chunk as { satisfied: boolean; output: string }
      expect(body.satisfied).toBe(true)
    })

    it('should throw 404 for non-existent prerequisite', async () => {
      const elevated = useSystemIdentityContext({ injector })
      await expect(
        CheckPrerequisiteAction(createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' } })),
      ).rejects.toThrow('Prerequisite not found')
      await elevated[Symbol.asyncDispose]()
    })

    it('should check env-variable prerequisite using stack config', async () => {
      const ts = new Date().toISOString()
      delete process.env.STACK_CONFIGURED_VAR_12345

      await prereqStore.add({
        id: 'prereq-env-1',
        stackName: 'test-stack',
        name: 'Database URL',
        type: 'env-variable',
        config: { variableName: 'STACK_CONFIGURED_VAR_12345' },
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })
      await stackConfigStore.add({
        stackName: 'test-stack',
        mainDirectory: '/tmp',
        environmentVariables: {
          STACK_CONFIGURED_VAR_12345: { source: 'custom', customValue: 'configured-value' },
        },
        createdAt: ts,
        updatedAt: ts,
      })

      const elevated = useSystemIdentityContext({ injector })
      const result = await CheckPrerequisiteAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'prereq-env-1' } }),
      )
      await elevated[Symbol.asyncDispose]()

      const body = result.chunk as { satisfied: boolean; output: string }
      expect(body.satisfied).toBe(true)
      expect(body.output).toContain('custom value')
    })

    it('should return not satisfied when check throws', async () => {
      const ts = new Date().toISOString()
      await prereqStore.add({
        id: 'prereq-2',
        stackName: 'test-stack',
        name: 'Node.js',
        type: 'node',
        config: { minimumVersion: '18.0.0' },
        installationHelp: 'Install Node.js',
        createdAt: ts,
        updatedAt: ts,
      })

      execFileMock.mockRejectedValue(new Error('Command not found'))

      const elevated = useSystemIdentityContext({ injector })
      const result = await CheckPrerequisiteAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'prereq-2' } }),
      )
      await elevated[Symbol.asyncDispose]()

      const body = result.chunk as { satisfied: boolean; output: string }
      expect(body.satisfied).toBe(false)
      expect(body.output).toContain('Command not found')
    })
  })
})
