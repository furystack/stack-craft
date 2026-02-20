export class ServiceLogEntry {
  id!: number
  serviceId!: string
  processUid!: string
  stream!: 'stdout' | 'stderr'
  line!: string
  createdAt!: string
}
