import { createComponent, Shade } from '@furystack/shades'
import { Chip } from '@furystack/shades-common-components'
import type { Palette } from '@furystack/shades-common-components'
import type { CloneStatus, InstallStatus, BuildStatus, RunStatus } from 'common'

type StatusMapping<T extends string> = Record<T, { label: string; color: keyof Palette; icon: string }>

const cloneStatusMap: StatusMapping<CloneStatus> = {
  'not-cloned': { label: 'Not Cloned', color: 'secondary', icon: '·' },
  cloning: { label: 'Cloning', color: 'warning', icon: '⏳' },
  cloned: { label: 'Cloned', color: 'success', icon: '✓' },
  failed: { label: 'Failed', color: 'error', icon: '✗' },
}

const installStatusMap: StatusMapping<InstallStatus> = {
  'not-installed': { label: 'Not Installed', color: 'secondary', icon: '·' },
  installing: { label: 'Installing', color: 'warning', icon: '⏳' },
  installed: { label: 'Installed', color: 'success', icon: '✓' },
  failed: { label: 'Failed', color: 'error', icon: '✗' },
}

const buildStatusMap: StatusMapping<BuildStatus> = {
  'not-built': { label: 'Not Built', color: 'secondary', icon: '·' },
  building: { label: 'Building', color: 'warning', icon: '⏳' },
  built: { label: 'Built', color: 'success', icon: '✓' },
  failed: { label: 'Failed', color: 'error', icon: '✗' },
}

const runStatusMap: StatusMapping<RunStatus> = {
  stopped: { label: 'Stopped', color: 'secondary', icon: '·' },
  starting: { label: 'Starting', color: 'warning', icon: '⏳' },
  running: { label: 'Running', color: 'success', icon: '✓' },
  stopping: { label: 'Stopping', color: 'warning', icon: '⏳' },
  error: { label: 'Error', color: 'error', icon: '✗' },
}

export const CloneStatusChip = Shade<{ status: CloneStatus }>({
  shadowDomName: 'shade-clone-status-chip',
  render: ({ props }) => {
    const { label, color, icon } = cloneStatusMap[props.status]
    return (
      <Chip variant="outlined" color={color} size="small">
        {icon} {label}
      </Chip>
    )
  },
})

export const InstallStatusChip = Shade<{ status: InstallStatus }>({
  shadowDomName: 'shade-install-status-chip',
  render: ({ props }) => {
    const { label, color, icon } = installStatusMap[props.status]
    return (
      <Chip variant="outlined" color={color} size="small">
        {icon} {label}
      </Chip>
    )
  },
})

export const BuildStatusChip = Shade<{ status: BuildStatus }>({
  shadowDomName: 'shade-build-status-chip',
  render: ({ props }) => {
    const { label, color, icon } = buildStatusMap[props.status]
    return (
      <Chip variant="outlined" color={color} size="small">
        {icon} {label}
      </Chip>
    )
  },
})

export const RunStatusChip = Shade<{ status: RunStatus }>({
  shadowDomName: 'shade-run-status-chip',
  render: ({ props }) => {
    const { label, color, icon } = runStatusMap[props.status]
    return (
      <Chip variant="outlined" color={color} size="small">
        {icon} {label}
      </Chip>
    )
  },
})
