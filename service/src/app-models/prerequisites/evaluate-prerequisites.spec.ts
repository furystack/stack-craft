import { getRepository } from '@furystack/repository'
import { Prerequisite, PrerequisiteCheckResult, StackConfig } from 'common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../../test-helpers.js'
import { evaluatePrerequisites } from './evaluate-prerequisites.js'

vi.mock('./actions/check-prerequisite-action.js', () => ({
  runCheck: vi.fn(),
}))

const { runCheck } = await import('./actions/check-prerequisite-action.js')
const mockRunCheck = runCheck as unknown as ReturnType<typeof vi.fn>

describe('evaluatePrerequisites', () => {
  beforeEach(() => {
    mockRunCheck.mockReset()
  })

  it('should return early when no prerequisites exist', async () => {
    await withTestInjector(async ({ injector }) => {
      await evaluatePrerequisites(injector)
      expect(mockRunCheck).not.toHaveBeenCalled()
    })
  })

  it('should seed unchecked results and update with check output', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      mockRunCheck.mockResolvedValue({ satisfied: true, output: 'git version 2.43.0' })

      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(Prerequisite, 'id').add(elevated, {
        id: 'prereq-1',
        stackName: 'my-stack',
        name: 'Git',
        type: 'git',
        config: {},
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      await evaluatePrerequisites(injector)

      const results = await getRepository(elevated)
        .getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
        .find(elevated, {})

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('satisfied')
      expect(results[0].output).toBe('git version 2.43.0')
    })
  })

  it('should mark result as failed when check is not satisfied', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      mockRunCheck.mockResolvedValue({ satisfied: false, output: 'Node.js 16.0.0 < 18.0.0' })

      const ts = new Date().toISOString()
      await getRepository(elevated)
        .getDataSetFor(Prerequisite, 'id')
        .add(elevated, {
          id: 'prereq-node',
          stackName: 'my-stack',
          name: 'Node.js >= 18',
          type: 'node',
          config: { minimumVersion: '18.0.0' },
          installationHelp: '',
          createdAt: ts,
          updatedAt: ts,
        })

      await evaluatePrerequisites(injector)

      const results = await getRepository(elevated)
        .getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
        .find(elevated, {})

      expect(results[0].status).toBe('failed')
      expect(results[0].output).toBe('Node.js 16.0.0 < 18.0.0')
    })
  })

  it('should mark result as failed when runCheck throws', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      mockRunCheck.mockRejectedValue(new Error('command not found'))

      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(Prerequisite, 'id').add(elevated, {
        id: 'prereq-err',
        stackName: 'my-stack',
        name: 'Git',
        type: 'git',
        config: {},
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      await evaluatePrerequisites(injector)

      const results = await getRepository(elevated)
        .getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
        .find(elevated, {})

      expect(results[0].status).toBe('failed')
      expect(results[0].output).toBe('command not found')
    })
  })

  it('should handle non-Error thrown values gracefully', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      mockRunCheck.mockRejectedValue('unexpected')

      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(Prerequisite, 'id').add(elevated, {
        id: 'prereq-nonError',
        stackName: 'my-stack',
        name: 'Git',
        type: 'git',
        config: {},
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      await evaluatePrerequisites(injector)

      const results = await getRepository(elevated)
        .getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
        .find(elevated, {})

      expect(results[0].status).toBe('failed')
      expect(results[0].output).toBe('Check failed')
    })
  })

  it('should resolve env-variable config from stack config', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      mockRunCheck.mockResolvedValue({ satisfied: true, output: 'MY_VAR is set' })

      const ts = new Date().toISOString()
      await getRepository(elevated)
        .getDataSetFor(StackConfig, 'stackName')
        .add(elevated, {
          stackName: 'my-stack',
          mainDirectory: '/tmp/stack',
          environmentVariables: {
            MY_VAR: { source: 'custom', customValue: 'secret' },
          },
          createdAt: ts,
          updatedAt: ts,
        })
      await getRepository(elevated)
        .getDataSetFor(Prerequisite, 'id')
        .add(elevated, {
          id: 'prereq-env',
          stackName: 'my-stack',
          name: 'MY_VAR',
          type: 'env-variable',
          config: { variableName: 'MY_VAR' },
          installationHelp: '',
          createdAt: ts,
          updatedAt: ts,
        })

      await evaluatePrerequisites(injector)

      expect(mockRunCheck).toHaveBeenCalledWith(
        'env-variable',
        { variableName: 'MY_VAR' },
        { envVarConfig: { source: 'custom', customValue: 'secret' } },
      )
    })
  })

  it('should evaluate multiple prerequisites', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      mockRunCheck.mockResolvedValue({ satisfied: true, output: 'ok' })

      const ts = new Date().toISOString()
      const ds = getRepository(elevated).getDataSetFor(Prerequisite, 'id')
      await ds.add(elevated, {
        id: 'p1',
        stackName: 's',
        name: 'Git',
        type: 'git',
        config: {},
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })
      await ds.add(elevated, {
        id: 'p2',
        stackName: 's',
        name: 'Node',
        type: 'node',
        config: { minimumVersion: '18.0.0' },
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      await evaluatePrerequisites(injector)

      expect(mockRunCheck).toHaveBeenCalledTimes(2)

      const results = await getRepository(elevated)
        .getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
        .find(elevated, {})

      expect(results).toHaveLength(2)
      expect(results.every((r) => r.status === 'satisfied')).toBe(true)
    })
  })
})
