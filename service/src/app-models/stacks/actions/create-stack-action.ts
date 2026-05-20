import type { Injector } from '@furystack/inject'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { PostStackEndpoint } from 'common'
import { StackConfig, StackDefinition } from 'common'
import { randomUUID } from 'crypto'

import { CryptoService } from '../../../utils/crypto-service.js'
import { encryptEnvValues } from '../../../utils/env-encryption-helpers.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

const assertNoStackNameCollision = async (injector: Injector, name: string | undefined): Promise<void> => {
  if (name === undefined) return
  const stackDefDs = getRepository(injector).getDataSetFor(StackDefinition, 'name')
  const existing = await stackDefDs.get(injector, name)
  if (existing) {
    throw new RequestError(`A stack named "${name}" already exists. Choose a different name.`, 409)
  }
}

/**
 * POST action that creates a new {@link StackDefinition} together with its
 * companion {@link StackConfig}. The two inserts are atomic from the caller's
 * point of view: if `StackConfig.add` throws, the just-written
 * `StackDefinition` row is removed before the error is re-thrown.
 */
export const CreateStackAction: RequestAction<PostStackEndpoint> = async ({ injector, getBody }) => {
  const body = await getBody()
  const repo = getRepository(injector)
  const crypto = injector.get(CryptoService)
  const now = new Date().toISOString()
  const stackDefDs = repo.getDataSetFor(StackDefinition, 'name')
  const stackConfigDs = repo.getDataSetFor(StackConfig, 'stackName')

  await assertNoStackNameCollision(injector, body.name)

  const name = body.name ?? randomUUID()
  const def = {
    name,
    displayName: body.displayName,
    description: body.description ?? '',
    createdAt: now,
    updatedAt: now,
  }
  const config = {
    stackName: name,
    mainDirectory: body.mainDirectory,
    environmentVariables: encryptEnvValues(crypto, body.environmentVariables ?? {}),
    createdAt: now,
    updatedAt: now,
  }

  await stackDefDs.add(injector, def)
  try {
    await stackConfigDs.add(injector, config)
  } catch (error) {
    await stackDefDs.remove(injector, name).catch(() => undefined)
    throw error instanceof RequestError
      ? error
      : new RequestError(
          `Failed to create stack "${name}": ${error instanceof Error ? error.message : 'unknown error'}`,
          500,
        )
  }

  return JsonResult({ ...def, ...config })
}
