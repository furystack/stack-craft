import { describe, expect, it } from 'vitest'
import type { ServiceDefinition } from 'common'

import { computeExecutionLevels } from './service-graph-resolver.js'

const makeService = (id: string, prerequisiteServiceIds: string[] = []): ServiceDefinition =>
  ({
    id,
    prerequisiteServiceIds,
    stackName: 'test-stack',
    displayName: id,
    description: '',
    runCommand: 'echo test',
    prerequisiteIds: [],
    files: [],
    createdAt: '',
    updatedAt: '',
  }) as ServiceDefinition

describe('computeExecutionLevels', () => {
  it('should return a single level for independent services', () => {
    const a = makeService('a')
    const b = makeService('b')
    const c = makeService('c')
    const serviceMap = new Map([
      ['a', a],
      ['b', b],
      ['c', c],
    ])
    const levels = computeExecutionLevels(['a', 'b', 'c'], serviceMap, new Set(['a', 'b', 'c']))
    expect(levels).toEqual([['a', 'b', 'c']])
  })

  it('should order services by their dependencies', () => {
    const db = makeService('db')
    const api = makeService('api', ['db'])
    const web = makeService('web', ['api'])
    const serviceMap = new Map([
      ['db', db],
      ['api', api],
      ['web', web],
    ])
    const levels = computeExecutionLevels(['db', 'api', 'web'], serviceMap, new Set(['db', 'api', 'web']))
    expect(levels).toEqual([['db'], ['api'], ['web']])
  })

  it('should group services at the same dependency level', () => {
    const db = makeService('db')
    const cache = makeService('cache')
    const api = makeService('api', ['db', 'cache'])
    const serviceMap = new Map([
      ['db', db],
      ['cache', cache],
      ['api', api],
    ])
    const levels = computeExecutionLevels(['db', 'cache', 'api'], serviceMap, new Set(['db', 'cache', 'api']))
    expect(levels).toHaveLength(2)
    expect(levels[0]).toContain('db')
    expect(levels[0]).toContain('cache')
    expect(levels[1]).toEqual(['api'])
  })

  it('should handle circular dependencies by merging into one level', () => {
    const a = makeService('a', ['b'])
    const b = makeService('b', ['a'])
    const serviceMap = new Map([
      ['a', a],
      ['b', b],
    ])
    const levels = computeExecutionLevels(['a', 'b'], serviceMap, new Set(['a', 'b']))
    expect(levels).toHaveLength(1)
    expect(levels[0]).toContain('a')
    expect(levels[0]).toContain('b')
  })

  it('should ignore dependencies outside the target set', () => {
    const ext = makeService('ext')
    const a = makeService('a', ['ext'])
    const serviceMap = new Map([
      ['ext', ext],
      ['a', a],
    ])
    const levels = computeExecutionLevels(['a'], serviceMap, new Set(['a']))
    expect(levels).toEqual([['a']])
  })

  it('should handle a single service', () => {
    const a = makeService('a')
    const serviceMap = new Map([['a', a]])
    const levels = computeExecutionLevels(['a'], serviceMap, new Set(['a']))
    expect(levels).toEqual([['a']])
  })

  it('should handle an empty list', () => {
    const levels = computeExecutionLevels([], new Map(), new Set())
    expect(levels).toEqual([])
  })
})
