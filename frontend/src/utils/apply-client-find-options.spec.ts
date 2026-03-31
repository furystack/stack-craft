import { describe, expect, it } from 'vitest'

import { applyClientFindOptions } from './apply-client-find-options.js'

type Item = { id: number; name: string }

const items: Item[] = [
  { id: 3, name: 'Charlie' },
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 4, name: 'Diana' },
]

describe('applyClientFindOptions', () => {
  it('should return all items with no options', () => {
    const result = applyClientFindOptions(items, {})
    expect(result.entries).toHaveLength(4)
    expect(result.count).toBe(4)
  })

  it('should filter items', () => {
    const result = applyClientFindOptions(items, {
      filter: { name: { $eq: 'Alice' } },
    })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].name).toBe('Alice')
    expect(result.count).toBe(1)
  })

  it('should order items ascending', () => {
    const result = applyClientFindOptions(items, {
      order: { id: 'ASC' },
    })
    expect(result.entries.map((e) => e.id)).toEqual([1, 2, 3, 4])
  })

  it('should order items descending', () => {
    const result = applyClientFindOptions(items, {
      order: { id: 'DESC' },
    })
    expect(result.entries.map((e) => e.id)).toEqual([4, 3, 2, 1])
  })

  it('should apply top (limit)', () => {
    const result = applyClientFindOptions(items, {
      order: { id: 'ASC' },
      top: 2,
    })
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.id)).toEqual([1, 2])
    expect(result.count).toBe(4)
  })

  it('should apply skip (offset)', () => {
    const result = applyClientFindOptions(items, {
      order: { id: 'ASC' },
      skip: 2,
    })
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.id)).toEqual([3, 4])
  })

  it('should apply skip and top together', () => {
    const result = applyClientFindOptions(items, {
      order: { id: 'ASC' },
      skip: 1,
      top: 2,
    })
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.id)).toEqual([2, 3])
    expect(result.count).toBe(4)
  })

  it('should handle an empty array', () => {
    const result = applyClientFindOptions([], {})
    expect(result.entries).toHaveLength(0)
    expect(result.count).toBe(0)
  })
})
