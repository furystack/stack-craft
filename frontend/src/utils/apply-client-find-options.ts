import type { FindOptions } from '@furystack/core'
import { filterItems } from '@furystack/core'

/**
 * Applies FindOptions (filter, order, skip, top) to an in-memory array.
 * Uses `filterItems` from `@furystack/core` for filtering, then adds
 * ordering and pagination on top (same logic as InMemoryStore.find).
 * @returns The paged entries and the total count after filtering (before paging).
 */
export const applyClientFindOptions = <T>(
  allEntries: T[],
  findOptions: FindOptions<T, Array<keyof T>>,
): { entries: T[]; count: number } => {
  let result = filterItems(allEntries, findOptions.filter)

  if (findOptions.order) {
    const orderRecord = findOptions.order as Record<string, 'ASC' | 'DESC'>
    for (const fieldName of Object.keys(findOptions.order) as Array<keyof T>) {
      result = result.sort((a, b) => {
        const order = orderRecord[fieldName as string]
        if (a[fieldName] < b[fieldName]) return order === 'ASC' ? -1 : 1
        if (a[fieldName] > b[fieldName]) return order === 'ASC' ? 1 : -1
        return 0
      })
    }
  }

  const count = result.length

  if (findOptions.top || findOptions.skip) {
    result = result.slice(findOptions.skip, (findOptions.skip || 0) + (findOptions.top || allEntries.length))
  }

  return { entries: result, count }
}
