import { defineService, type Token } from '@furystack/inject'
import type { EnvironmentVariableValue } from 'common'

import { SystemApiClient } from './api-clients/system-api-client.js'

const UNCHANGED_SENTINEL = '__UNCHANGED__'

class EnvironmentVariableServiceImpl {
  constructor(private readonly systemApiClient: SystemApiClient) {}

  public async checkAvailability(variableNames: string[]): Promise<Record<string, boolean>> {
    if (variableNames.length === 0) return {}
    const { result } = await this.systemApiClient.call({
      method: 'POST',
      action: '/system/check-env-availability',
      body: { variableNames },
    })
    return result
  }

  public buildSavePayload(
    editState: Record<string, EnvironmentVariableValue>,
    touchedSensitiveKeys: ReadonlySet<string>,
  ): Record<string, EnvironmentVariableValue> {
    const toSave: Record<string, EnvironmentVariableValue> = {}
    for (const [key, val] of Object.entries(editState)) {
      if (val.isSensitive && val.source === 'custom' && !touchedSensitiveKeys.has(key)) {
        toSave[key] = { ...val, customValue: UNCHANGED_SENTINEL }
      } else {
        toSave[key] = val
      }
    }
    return toSave
  }
}

export type EnvironmentVariableService = EnvironmentVariableServiceImpl

export const EnvironmentVariableService: Token<EnvironmentVariableService, 'singleton'> = defineService({
  name: 'app/EnvironmentVariableService',
  lifetime: 'singleton',
  factory: ({ inject }) => new EnvironmentVariableServiceImpl(inject(SystemApiClient)),
})
