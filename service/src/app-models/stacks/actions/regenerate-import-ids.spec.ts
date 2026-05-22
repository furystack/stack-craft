import type { ImportStackEndpoint } from 'common'
import { describe, expect, it } from 'vitest'

import { regenerateImportIds } from './regenerate-import-ids.js'

type ImportBody = ImportStackEndpoint['body']

const buildBody = (overrides: Partial<ImportBody> = {}): ImportBody => ({
  stack: { name: 'src-stack', displayName: 'Source', description: '' },
  services: [],
  repositories: [],
  prerequisites: [],
  config: { mainDirectory: '/tmp/src' },
  ...overrides,
})

describe('regenerateImportIds', () => {
  it('replaces every service / repository / prerequisite ID with a fresh UUID', () => {
    const body = buildBody({
      services: [
        {
          id: 'svc-1',
          displayName: 'Svc 1',
          description: '',
          workingDirectory: 'svc1',
          runCommand: 'echo',
          prerequisiteIds: [],
          prerequisiteServiceIds: [],
          files: [],
        },
      ],
      repositories: [
        {
          id: 'repo-1',
          url: 'https://github.com/test/repo',
          displayName: 'Repo 1',
          description: '',
        },
      ],
      prerequisites: [
        {
          id: 'prereq-1',
          name: 'Node',
          type: 'node',
          config: {},
          installationHelp: '',
        },
      ],
    })

    const result = regenerateImportIds(body)

    expect(result.services[0]?.id).not.toBe('svc-1')
    expect(result.repositories[0]?.id).not.toBe('repo-1')
    expect(result.prerequisites[0]?.id).not.toBe('prereq-1')
    expect(result.services[0]?.id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('remaps prerequisiteIds and prerequisiteServiceIds through the new ID tables', () => {
    const body = buildBody({
      services: [
        {
          id: 'svc-a',
          displayName: 'A',
          description: '',
          workingDirectory: 'a',
          runCommand: 'echo a',
          prerequisiteIds: ['prereq-a', 'prereq-b'],
          prerequisiteServiceIds: ['svc-b'],
          files: [],
        },
        {
          id: 'svc-b',
          displayName: 'B',
          description: '',
          workingDirectory: 'b',
          runCommand: 'echo b',
          prerequisiteIds: [],
          prerequisiteServiceIds: [],
          files: [],
        },
      ],
      prerequisites: [
        { id: 'prereq-a', name: 'A', type: 'node', config: {}, installationHelp: '' },
        { id: 'prereq-b', name: 'B', type: 'node', config: {}, installationHelp: '' },
      ],
    })

    const result = regenerateImportIds(body)

    const newSvcAId = result.services[0]?.id
    const newSvcBId = result.services[1]?.id
    const newPrereqAId = result.prerequisites[0]?.id
    const newPrereqBId = result.prerequisites[1]?.id

    expect(result.services[0]?.prerequisiteIds).toEqual([newPrereqAId, newPrereqBId])
    expect(result.services[0]?.prerequisiteServiceIds).toEqual([newSvcBId])
    expect(newSvcAId).not.toBe(newSvcBId)
  })

  it('rekeys config.services from old to new service IDs', () => {
    const body = buildBody({
      services: [
        {
          id: 'svc-1',
          displayName: 'Svc 1',
          description: '',
          workingDirectory: 'svc1',
          runCommand: 'echo',
          prerequisiteIds: [],
          prerequisiteServiceIds: [],
          files: [],
        },
      ],
      config: {
        mainDirectory: '/tmp/src',
        services: {
          'svc-1': { autoFetchEnabled: true, autoFetchIntervalMinutes: 15 },
        },
      },
    })

    const result = regenerateImportIds(body)
    const newSvcId = result.services[0]?.id ?? 'unset'

    expect(Object.keys(result.config.services ?? {})).toEqual([newSvcId])
    expect(result.config.services?.[newSvcId]?.autoFetchEnabled).toBe(true)
    expect(result.config.services?.[newSvcId]?.autoFetchIntervalMinutes).toBe(15)
  })

  it('does not mutate the input body', () => {
    const body = buildBody({
      services: [
        {
          id: 'svc-1',
          displayName: 'Svc 1',
          description: '',
          workingDirectory: 'svc1',
          runCommand: 'echo',
          prerequisiteIds: [],
          prerequisiteServiceIds: [],
          files: [],
        },
      ],
    })
    const snapshot = JSON.parse(JSON.stringify(body)) as ImportBody

    regenerateImportIds(body)

    expect(body).toEqual(snapshot)
  })

  it('preserves orphan references unchanged (no map entry → pass through)', () => {
    const body = buildBody({
      services: [
        {
          id: 'svc-1',
          displayName: 'Svc 1',
          description: '',
          workingDirectory: 'svc1',
          runCommand: 'echo',
          prerequisiteIds: ['missing-prereq'],
          prerequisiteServiceIds: ['missing-svc'],
          files: [],
        },
      ],
    })

    const result = regenerateImportIds(body)

    expect(result.services[0]?.prerequisiteIds).toEqual(['missing-prereq'])
    expect(result.services[0]?.prerequisiteServiceIds).toEqual(['missing-svc'])
  })
})
