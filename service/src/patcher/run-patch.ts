import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'

import type { Patch } from './patch.js'
import type { PatchRunStore } from './patch-run-store.js'

/**
 * Runs a patch once. Skips if the patch has a prior `success` entry.
 * Records a `running` row that is updated to `success` or `failed` on completion.
 */
export const runPatch = async (injector: Injector, patch: Patch, patchRunDataSet: PatchRunStore): Promise<void> => {
  const logger = getLogger(injector).withScope('Patch Runner')

  const alreadyRun = await patchRunDataSet.find(injector, {
    filter: { patchId: { $eq: patch.id } },
  })

  if (alreadyRun.some((p) => p.status === 'success')) {
    await logger.verbose({ message: `Patch ${patch.id} has already been applied.` })
    return
  }

  if (alreadyRun.some((p) => p.status === 'running')) {
    await logger.verbose({ message: `Patch ${patch.id} is already running.` })
    return
  }

  if (alreadyRun.some((p) => p.status === 'failed')) {
    await logger.warning({ message: `Patch ${patch.id} previously failed. Retrying.` })
  }

  await logger.verbose({ message: `Running patch ${patch.id}...` })

  const { created } = await patchRunDataSet.add(injector, {
    patchId: patch.id,
    name: patch.name,
    description: patch.description,
    status: 'running',
    log: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const newPatchRun = created[0]
  if (!newPatchRun) return

  const collectedLog: Array<{ timestamp: string; message: string }> = []

  try {
    await patch.run(injector, (message) => {
      collectedLog.push({ timestamp: new Date().toISOString(), message })
    })
    await patchRunDataSet.update(injector, newPatchRun.id, {
      status: 'success',
      log: collectedLog,
      updatedAt: new Date(),
    })
    await logger.verbose({ message: `Patch ${patch.id} completed.` })
  } catch (error) {
    const err = error as Error
    await logger.error({ message: `Patch ${patch.id} failed.`, data: { error: err.message } })
    await patchRunDataSet.update(injector, newPatchRun.id, {
      status: 'failed',
      updatedAt: new Date(),
      log: [
        ...collectedLog,
        {
          timestamp: new Date().toISOString(),
          message: `Patch failed. Error: ${err.message}, stack: ${err.stack ?? ''}`,
        },
      ],
    })
    throw error
  }
}
