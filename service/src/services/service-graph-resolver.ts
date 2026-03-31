/**
 * Computes execution levels via topological sort with cycle resolution.
 * Returns an array of arrays: each inner array is a set of service IDs
 * that can run in parallel. Levels are executed sequentially.
 *
 * Circular dependencies are resolved by merging cycle members into the
 * same level so they run in parallel rather than deadlocking.
 *
 * @param dependencyMap Maps each serviceId to the IDs of services it depends on
 */
export const computeExecutionLevels = (
  serviceIds: string[],
  dependencyMap: Map<string, string[]>,
  targetSet: Set<string>,
): string[][] => {
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const id of serviceIds) {
    inDegree.set(id, 0)
    dependents.set(id, [])
  }

  for (const id of serviceIds) {
    const deps = dependencyMap.get(id) ?? []
    for (const prereq of deps) {
      if (targetSet.has(prereq)) {
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
        dependents.get(prereq)?.push(id)
      }
    }
  }

  const levels: string[][] = []
  const remaining = new Set(serviceIds)

  while (remaining.size > 0) {
    const level = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0)

    if (level.length === 0) {
      levels.push([...remaining])
      break
    }

    levels.push(level)

    for (const id of level) {
      remaining.delete(id)
      for (const dep of dependents.get(id) ?? []) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) - 1)
      }
    }
  }

  return levels
}
