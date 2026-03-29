import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import type { EnvironmentVariableValue } from 'common'
import { ServiceConfig, StackConfig } from 'common'

import { CryptoService } from './crypto-service.js'

/**
 * One-time migration that encrypts any `customValue` entries marked as
 * `isSensitive` that are still stored in plain text.
 * Safe to run repeatedly - already-encrypted values are skipped.
 */
export const encryptExistingSecrets = async (injector: Injector): Promise<void> => {
  const logger = getLogger(injector).withScope('EncryptExistingSecrets')
  const crypto = injector.getInstance(CryptoService)
  const repository = getRepository(injector)

  const encryptRecord = (
    vars: Record<string, EnvironmentVariableValue>,
  ): { changed: boolean; result: Record<string, EnvironmentVariableValue> } => {
    let changed = false
    const result: Record<string, EnvironmentVariableValue> = {}
    for (const [key, val] of Object.entries(vars)) {
      if (val.isSensitive && val.source === 'custom' && val.customValue && !crypto.isEncrypted(val.customValue)) {
        result[key] = { ...val, customValue: crypto.encrypt(val.customValue) }
        changed = true
      } else {
        result[key] = val
      }
    }
    return { changed, result }
  }

  const stackConfigs = await repository.getDataSetFor(StackConfig, 'stackName').find(injector, {})
  for (const config of stackConfigs) {
    const { changed, result } = encryptRecord(config.environmentVariables ?? {})
    if (changed) {
      await repository.getDataSetFor(StackConfig, 'stackName').update(injector, config.stackName, {
        environmentVariables: result,
      })
      await logger.information({ message: `Encrypted existing sensitive values in stack config: ${config.stackName}` })
    }
  }

  const serviceConfigs = await repository.getDataSetFor(ServiceConfig, 'serviceId').find(injector, {})
  for (const config of serviceConfigs) {
    const { changed, result } = encryptRecord(config.environmentVariableOverrides ?? {})
    if (changed) {
      await repository.getDataSetFor(ServiceConfig, 'serviceId').update(injector, config.serviceId, {
        environmentVariableOverrides: result,
      })
      await logger.information({
        message: `Encrypted existing sensitive values in service config: ${config.serviceId}`,
      })
    }
  }
}
