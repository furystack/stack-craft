import type { InstallStatus, BuildStatus, RunStatus } from '../models/service.js'

export type WebsocketMessage =
  | {
      type: 'service-status-changed'
      serviceId: string
      installStatus: InstallStatus
      buildStatus: BuildStatus
      runStatus: RunStatus
    }
  | {
      type: 'service-log'
      serviceId: string
      stream: 'stdout' | 'stderr'
      line: string
    }
  | {
      type: 'git-branches-changed'
      serviceId: string
      newBranches: string[]
    }
  | {
      type: 'dependency-check-result'
      dependencyId: string
      satisfied: boolean
      output: string
    }
