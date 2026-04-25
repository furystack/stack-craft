import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServiceStatusModel } from '../app-models/data-store/models.js'
import { addStaleStatusEnumPatch } from './0001-add-stale-status-enum.js'

type SequelizeSlot = { sequelize: unknown }
type AttributesFn = typeof ServiceStatusModel.getAttributes

const getSlot = () => ServiceStatusModel as unknown as SequelizeSlot

describe('addStaleStatusEnumPatch', () => {
  const origSequelize = getSlot().sequelize
  const origGetAttributes = ServiceStatusModel.getAttributes

  afterEach(() => {
    getSlot().sequelize = origSequelize
    ;(ServiceStatusModel as unknown as { getAttributes: AttributesFn }).getAttributes = origGetAttributes
    vi.restoreAllMocks()
  })

  it('exposes the expected id, name and description', () => {
    expect(addStaleStatusEnumPatch.id).toBe('0001-add-stale-status-enum')
    expect(addStaleStatusEnumPatch.name).toBeTruthy()
    expect(addStaleStatusEnumPatch.description).toBeTruthy()
  })

  it('throws when ServiceStatusModel has no sequelize instance', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      getSlot().sequelize = undefined

      await expect(addStaleStatusEnumPatch.run(injector, () => undefined)).rejects.toThrow(/Sequelize unavailable/)
    }))

  it('invokes ensureEnums with installStatus + buildStatus attributes from the model', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)

      const ensureEnums = vi.fn().mockResolvedValue(undefined)
      const getQueryInterface = vi.fn().mockReturnValue({ ensureEnums })
      getSlot().sequelize = { getQueryInterface }

      const fakeAttributes = {
        installStatus: { type: 'INSTALL_ENUM' },
        buildStatus: { type: 'BUILD_ENUM' },
        cloneStatus: { type: 'CLONE_ENUM' },
      }
      ;(ServiceStatusModel as unknown as { getAttributes: AttributesFn }).getAttributes = (() =>
        fakeAttributes) as unknown as AttributesFn

      const logs: string[] = []
      await addStaleStatusEnumPatch.run(injector, (msg) => logs.push(msg))

      expect(getQueryInterface).toHaveBeenCalledTimes(1)
      expect(ensureEnums).toHaveBeenCalledTimes(1)
      const [tableName, passedAttributes, options, model] = ensureEnums.mock.calls[0] ?? []
      expect(tableName).toBe(ServiceStatusModel.tableName)
      expect(passedAttributes).toEqual({
        installStatus: fakeAttributes.installStatus,
        buildStatus: fakeAttributes.buildStatus,
      })
      expect(options).toEqual({})
      expect(model).toBe(ServiceStatusModel)
      expect(logs.length).toBeGreaterThan(0)
    }))

  it('propagates errors from ensureEnums', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)

      const ensureEnums = vi.fn().mockRejectedValue(new Error('enum failure'))
      getSlot().sequelize = { getQueryInterface: () => ({ ensureEnums }) }
      ;(ServiceStatusModel as unknown as { getAttributes: AttributesFn }).getAttributes = (() => ({
        installStatus: {},
        buildStatus: {},
      })) as unknown as AttributesFn

      await expect(addStaleStatusEnumPatch.run(injector, () => undefined)).rejects.toThrow('enum failure')
    }))
})
