import type { CloneStatus, InstallStatus, BuildStatus, RunStatus } from '../models/service-status.js'

export type WebsocketMessage =
  | {
      type: 'service-status-changed'
      serviceId: string
      cloneStatus: CloneStatus
      installStatus: InstallStatus
      buildStatus: BuildStatus
      runStatus: RunStatus
      currentBranch?: string
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
