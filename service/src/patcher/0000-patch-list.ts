import { addStaleStatusEnumPatch } from './0001-add-stale-status-enum.js'
import type { Patch } from './patch.js'

/** Ordered list of patches. Each patch runs at most once per installation. */
export const patchList: Patch[] = [addStaleStatusEnumPatch]
