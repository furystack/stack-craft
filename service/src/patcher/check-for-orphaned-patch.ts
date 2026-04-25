import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'

import type { PatchRunStore } from './patch-run-store.js'

/**
 * Transitions any patch rows stuck in `running` (from a previous crash) to `orphaned`
 * so the corresponding patch can be retried on next startup.
 */
export const checkForOrphanedPatch = async (injector: Injector, dataSet: PatchRunStore): Promise<void> => {
  const logger = getLogger(injector).withScope('Orphaned Patch Checker')

  const toBeOrphaned = await dataSet.find(injector, {
    filter: { status: { $eq: 'running' } },
  })

  if (toBeOrphaned.length === 0) return

  await logger.warning({
    message: `Found ${toBeOrphaned.length} patches in "Running" state. Setting them to "Orphaned"`,
  })

  await Promise.all(
    toBeOrphaned.map(async (p) => {
      await dataSet.update(injector, p.id, {
        status: 'orphaned',
        updatedAt: new Date(),
        log: [
          ...(p.log ?? []),
          {
            timestamp: new Date().toISOString(),
            message: 'Found in running state during init. Set as "Orphaned"',
          },
        ],
      })
    }),
  )
}
