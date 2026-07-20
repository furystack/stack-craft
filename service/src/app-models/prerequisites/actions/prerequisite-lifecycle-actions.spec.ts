import { PrerequisiteCheckResultDataSet, PrerequisiteDataSet } from '../../data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { readPostBody } from '@furystack/rest-service'
import { describe, expect, it, vi } from 'vitest'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { CreatePrerequisiteAction, DeletePrerequisiteAction } from './prerequisite-lifecycle-actions.js'
vi.mock('@furystack/rest-service', async () => {
  const actual: Record<string, unknown> = await vi.importActual('@furystack/rest-service')
  return {
    ...actual,
    readPostBody: vi.fn(),
  }
})

const mockedReadPostBody = readPostBody as ReturnType<typeof vi.fn>

describe('CreatePrerequisiteAction', () => {
  it('should create a prerequisite and seed an unchecked check result', async () => {
    await withTestInjector(async ({ elevated }) => {
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
        ...createMockActionContext({ injector: elevated }),
        request: {} as never,
      })

      expect(result.statusCode).toBe(201)

      const storedPrereqs = await getDataSetFor(elevated, PrerequisiteDataSet).find(elevated, {})
      expect(storedPrereqs).toHaveLength(1)
      expect(storedPrereqs[0].name).toBe('Node.js >= 18')

      const checkResults = await getDataSetFor(elevated, PrerequisiteCheckResultDataSet).find(elevated, {})
      expect(checkResults).toHaveLength(1)
      expect(checkResults[0].prerequisiteId).toBe('prereq-1')
      expect(checkResults[0].status).toBe('unchecked')
    })
  })

  it('should reject with 409 when a prerequisite with the same id already exists', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, PrerequisiteDataSet).add(elevated, {
        id: 'existing-prereq',
        stackName: 'stack',
        name: 'Existing',
        type: 'custom-script',
        config: { script: 'echo existing' },
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      mockedReadPostBody.mockResolvedValue({
        id: 'existing-prereq',
        stackName: 'stack',
        name: 'Duplicate',
        type: 'custom-script' as const,
        config: { script: 'echo dup' },
        installationHelp: '',
      })

      await expect(
        CreatePrerequisiteAction({
          ...createMockActionContext({ injector: elevated }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('"existing-prereq" already exists'),
        responseCode: 409,
      })

      const prereqs = await getDataSetFor(elevated, PrerequisiteDataSet).find(elevated, {})
      expect(prereqs).toHaveLength(1)
      expect(prereqs[0].name).toBe('Existing')
    })
  })

  it('should roll back the prerequisite when seeding the check result fails', async () => {
    await withTestInjector(async ({ elevated }) => {
      mockedReadPostBody.mockResolvedValue({
        id: 'rollback-prereq',
        stackName: 'stack',
        name: 'Rollback',
        type: 'custom-script' as const,
        config: { script: 'echo rollback' },
        installationHelp: '',
      })

      const checkResultDs = getDataSetFor(elevated, PrerequisiteCheckResultDataSet)
      vi.spyOn(checkResultDs, 'add').mockRejectedValueOnce(new Error('check-result store down'))

      await expect(
        CreatePrerequisiteAction({
          ...createMockActionContext({ injector: elevated }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('check-result store down'),
        responseCode: 500,
      })

      const prereqs = await getDataSetFor(elevated, PrerequisiteDataSet).find(elevated, {})
      expect(prereqs).toHaveLength(0)
    })
  })

  it('should throw 500 when prerequisite creation returns empty', async () => {
    await withTestInjector(async ({ elevated }) => {
      mockedReadPostBody.mockResolvedValue({
        id: 'prereq-2',
        stackName: 'my-stack',
        name: 'Docker',
        type: 'custom-script' as const,
        config: { script: 'docker -v' },
        installationHelp: 'Install Docker',
      })

      const ds = getDataSetFor(elevated, PrerequisiteDataSet)
      const originalAdd = ds.add.bind(ds)
      vi.spyOn(ds, 'add').mockImplementation(async (...args) => {
        await originalAdd(...args)
        return { created: [] }
      })

      await expect(
        CreatePrerequisiteAction({
          ...createMockActionContext({ injector: elevated }),
          request: {} as never,
        }),
      ).rejects.toThrow('Prerequisite not created')
    })
  })
})

describe('DeletePrerequisiteAction', () => {
  it('should delete prerequisite and its check result', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, PrerequisiteDataSet).add(elevated, {
        id: 'prereq-del',
        stackName: 'stack',
        name: 'Node',
        type: 'custom-script',
        config: { script: 'node -v' },
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      await getDataSetFor(elevated, PrerequisiteCheckResultDataSet).add(elevated, {
        prerequisiteId: 'prereq-del',
        status: 'satisfied',
        output: 'v20.0.0',
        checkedAt: ts,
      })

      const result = await DeletePrerequisiteAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'prereq-del' } }),
      )

      expect(result.statusCode).toBe(204)

      const remainingPrereqs = await getDataSetFor(elevated, PrerequisiteDataSet).find(elevated, {})
      expect(remainingPrereqs).toHaveLength(0)

      const remainingResults = await getDataSetFor(elevated, PrerequisiteCheckResultDataSet).find(elevated, {})
      expect(remainingResults).toHaveLength(0)
    })
  })

  it('should delete prerequisite even when no check result exists', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, PrerequisiteDataSet).add(elevated, {
        id: 'prereq-no-result',
        stackName: 'stack',
        name: 'Docker',
        type: 'custom-script',
        config: { script: 'docker -v' },
        installationHelp: '',
        createdAt: ts,
        updatedAt: ts,
      })

      const result = await DeletePrerequisiteAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'prereq-no-result' } }),
      )

      expect(result.statusCode).toBe(204)

      const remainingPrereqs = await getDataSetFor(elevated, PrerequisiteDataSet).find(elevated, {})
      expect(remainingPrereqs).toHaveLength(0)
    })
  })
})
