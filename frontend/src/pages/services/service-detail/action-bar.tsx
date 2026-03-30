import { createComponent, Shade } from '@furystack/shades'
import { Button, Chip, Icon, icons } from '@furystack/shades-common-components'
import type { Prerequisite, ServiceView } from 'common'

import { BranchSelector } from '../../../components/branch-selector.js'
import { ServiceStatusIndicator } from '../../../components/service-status-indicator.js'
import { getPrimaryAction, getSecondaryActions } from '../../../utils/service-pipeline.js'

type ServiceDetailActionBarProps = {
  service: ServiceView
  servicePrereqs: Prerequisite[]
  prereqSatisfiedCount: number
  prereqFailedCount: number
  actionInProgress: string | null
  onRunAction: (apiAction: string) => void
  onDelete: () => void
}

export const ServiceDetailActionBar = Shade<ServiceDetailActionBarProps>({
  customElementName: 'shade-service-detail-action-bar',
  render: ({ props }) => {
    const { service, servicePrereqs, prereqSatisfiedCount, prereqFailedCount, actionInProgress } = props

    const primary = getPrimaryAction(service)
    const secondaryActions = getSecondaryActions(service)

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <ServiceStatusIndicator service={service} />
        {service.repositoryId ? (
          <BranchSelector
            serviceId={service.id}
            currentBranch={service.currentBranch}
            isCloned={service.cloneStatus === 'cloned'}
          />
        ) : null}
        {servicePrereqs.length > 0 ? (
          <Chip
            variant="outlined"
            size="small"
            color={
              prereqFailedCount > 0 ? 'error' : prereqSatisfiedCount === servicePrereqs.length ? 'success' : 'secondary'
            }
          >
            {prereqSatisfiedCount === servicePrereqs.length
              ? '✓ Prerequisites OK'
              : `${prereqSatisfiedCount}/${servicePrereqs.length} prereqs`}
          </Chip>
        ) : null}
        {primary.apiAction ? (
          <Button
            variant="contained"
            size="small"
            color={primary.color === 'secondary' ? undefined : primary.color}
            loading={!!actionInProgress}
            disabled={!!actionInProgress}
            onclick={() => props.onRunAction(primary.apiAction)}
          >
            {primary.label}
          </Button>
        ) : null}
        {secondaryActions.map((action) => (
          <Button
            variant="outlined"
            size="small"
            color={action.color === 'secondary' ? undefined : action.color}
            title={action.tooltip}
            loading={actionInProgress === action.apiAction}
            disabled={!!actionInProgress}
            onclick={() => props.onRunAction(action.apiAction)}
          >
            {action.label}
          </Button>
        ))}
        <Button
          variant="outlined"
          size="small"
          color="error"
          onclick={props.onDelete}
          startIcon={<Icon icon={icons.trash} size="small" />}
        >
          Delete
        </Button>
      </div>
    )
  },
})
