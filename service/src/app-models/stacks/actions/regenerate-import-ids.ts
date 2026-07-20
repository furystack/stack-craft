import { randomUUID } from 'crypto'

import type { ImportStackEndpoint } from 'common'

type ImportBody = ImportStackEndpoint['body']

/**
 * Assigns fresh UUIDs to every service / repository / prerequisite in an import payload and
 * remaps every cross-entity reference accordingly. Used by the import action when the caller
 * sets `regenerateIds: true` (e.g. duplicating a stack on the same machine).
 *
 * Returns a new body object; the input is not mutated. If a referenced ID is missing from the
 * payload it is preserved as-is — the import action's downstream validation surfaces orphan
 * references through the normal failure path.
 */
export const regenerateImportIds = (body: ImportBody): ImportBody => {
  const serviceIdMap = new Map<string, string>(body.services.map((s) => [s.id, randomUUID()]))
  const repoIdMap = new Map<string, string>(body.repositories.map((r) => [r.id, randomUUID()]))
  const prereqIdMap = new Map<string, string>(body.prerequisites.map((p) => [p.id, randomUUID()]))

  const mapId = (table: Map<string, string>, id: string): string => table.get(id) ?? id

  const services = body.services.map((svc) => ({
    ...svc,
    id: mapId(serviceIdMap, svc.id),
    prerequisiteIds: svc.prerequisiteIds.map((id) => mapId(prereqIdMap, id)),
    prerequisiteServiceIds: svc.prerequisiteServiceIds.map((id) => mapId(serviceIdMap, id)),
  }))

  const repositories = body.repositories.map((repo) => ({ ...repo, id: mapId(repoIdMap, repo.id) }))
  const prerequisites = body.prerequisites.map((prereq) => ({ ...prereq, id: mapId(prereqIdMap, prereq.id) }))

  const remappedServiceConfigs = body.config.services
    ? Object.fromEntries(
        Object.entries(body.config.services).map(([oldId, value]) => [mapId(serviceIdMap, oldId), value]),
      )
    : undefined

  return {
    ...body,
    services,
    repositories,
    prerequisites,
    config: {
      ...body.config,
      ...(remappedServiceConfigs ? { services: remappedServiceConfigs } : {}),
    },
  }
}
