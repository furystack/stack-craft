/**
 * Log of a patch execution. Tracks idempotency (a successful run is skipped next time)
 * and provides an audit trail for upgrade operations.
 */
export class PatchRun {
  public id!: string
  public patchId!: string
  public createdAt!: Date
  public updatedAt!: Date
  public name!: string
  public description!: string
  public status!: 'running' | 'success' | 'failed' | 'orphaned'

  public log!: Array<{ timestamp: string; message: string }>
}
