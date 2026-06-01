import { Injector } from '@furystack/inject'
import { usingAsync } from '@furystack/utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BuildOperationLimit, GitOperationLimit, InstallOperationLimit } from './operation-limits.js'

const ENV_KEYS = [
  'STACK_CRAFT_MAX_PARALLEL_GIT',
  'STACK_CRAFT_MAX_PARALLEL_INSTALLS',
  'STACK_CRAFT_MAX_PARALLEL_BUILDS',
]

describe('operation limits', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key]
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  })

  it('uses defaults (10 / 3 / 1) when no env vars are set', () =>
    usingAsync(new Injector(), async (injector) => {
      for (const key of ENV_KEYS) delete process.env[key]
      expect(injector.get(GitOperationLimit).getMaxConcurrent()).toBe(10)
      expect(injector.get(InstallOperationLimit).getMaxConcurrent()).toBe(3)
      expect(injector.get(BuildOperationLimit).getMaxConcurrent()).toBe(1)
    }))

  it('honours valid integer overrides from env', () =>
    usingAsync(new Injector(), async (injector) => {
      process.env.STACK_CRAFT_MAX_PARALLEL_GIT = '5'
      process.env.STACK_CRAFT_MAX_PARALLEL_INSTALLS = '7'
      process.env.STACK_CRAFT_MAX_PARALLEL_BUILDS = '2'
      expect(injector.get(GitOperationLimit).getMaxConcurrent()).toBe(5)
      expect(injector.get(InstallOperationLimit).getMaxConcurrent()).toBe(7)
      expect(injector.get(BuildOperationLimit).getMaxConcurrent()).toBe(2)
    }))

  it('falls back to defaults on garbage / non-positive overrides', () =>
    usingAsync(new Injector(), async (injector) => {
      process.env.STACK_CRAFT_MAX_PARALLEL_GIT = 'banana'
      process.env.STACK_CRAFT_MAX_PARALLEL_INSTALLS = '0'
      process.env.STACK_CRAFT_MAX_PARALLEL_BUILDS = '-3'
      expect(injector.get(GitOperationLimit).getMaxConcurrent()).toBe(10)
      expect(injector.get(InstallOperationLimit).getMaxConcurrent()).toBe(3)
      expect(injector.get(BuildOperationLimit).getMaxConcurrent()).toBe(1)
    }))
})
