import { describe, expect, it } from 'vitest'

import { computeExecutionLevels } from './service-graph-resolver.js'

describe('computeExecutionLevels', () => {
  it('should return a single level for independent services', () => {
    const dependencyMap = new Map<string, string[]>()
    const levels = computeExecutionLevels(['a', 'b', 'c'], dependencyMap, new Set(['a', 'b', 'c']))
    expect(levels).toEqual([['a', 'b', 'c']])
  })

  it('should order services by their dependencies', () => {
    const dependencyMap = new Map([
      ['api', ['db']],
      ['web', ['api']],
    ])
    const levels = computeExecutionLevels(['db', 'api', 'web'], dependencyMap, new Set(['db', 'api', 'web']))
    expect(levels).toEqual([['db'], ['api'], ['web']])
  })

  it('should group services at the same dependency level', () => {
    const dependencyMap = new Map([['api', ['db', 'cache']]])
    const levels = computeExecutionLevels(['db', 'cache', 'api'], dependencyMap, new Set(['db', 'cache', 'api']))
    expect(levels).toHaveLength(2)
    expect(levels[0]).toContain('db')
    expect(levels[0]).toContain('cache')
    expect(levels[1]).toEqual(['api'])
  })

  it('should handle circular dependencies by merging into one level', () => {
    const dependencyMap = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ])
    const levels = computeExecutionLevels(['a', 'b'], dependencyMap, new Set(['a', 'b']))
    expect(levels).toHaveLength(1)
    expect(levels[0]).toContain('a')
    expect(levels[0]).toContain('b')
  })

  it('should ignore dependencies outside the target set', () => {
    const dependencyMap = new Map([['a', ['ext']]])
    const levels = computeExecutionLevels(['a'], dependencyMap, new Set(['a']))
    expect(levels).toEqual([['a']])
  })

  it('should handle a single service', () => {
    const dependencyMap = new Map<string, string[]>()
    const levels = computeExecutionLevels(['a'], dependencyMap, new Set(['a']))
    expect(levels).toEqual([['a']])
  })

  it('should handle an empty list', () => {
    const levels = computeExecutionLevels([], new Map(), new Set())
    expect(levels).toEqual([])
  })
})
