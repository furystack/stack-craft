import { createComponent, Shade } from '@furystack/shades'
import type { MenuEntry } from '@furystack/shades-common-components'
import { Button, ButtonGroup, Dropdown, Icon, icons } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { BranchSelector } from '../../../components/branch-selector.js'
import { getPrimaryAction, getSecondaryActions } from '../../../utils/service-pipeline.js'

type ServiceDetailActionBarProps = {
  service: ServiceView
  actionInProgress: string | null
  isEditing: boolean
  onRunAction: (apiAction: string) => void
  onEdit: () => void
  onDelete: () => void
}

export const ServiceDetailActionBar = Shade<ServiceDetailActionBarProps>({
  customElementName: 'shade-service-detail-action-bar',
  render: ({ props }) => {
    const { service, actionInProgress, isEditing } = props

    if (isEditing) return <div />

    const primary = getPrimaryAction(service)
    const secondaryActions = getSecondaryActions(service)

    const dropdownItems: MenuEntry[] = [
      ...secondaryActions.map((action) => ({
        key: action.apiAction,
        label: action.label,
        icon: action.icon,
      })),
      ...(secondaryActions.length > 0 ? [{ type: 'divider' as const, key: 'sep' }] : []),
      { key: 'delete', label: 'Delete', icon: <Icon icon={icons.trash} size="small" /> },
    ]

    const handleDropdownSelect = (key: string) => {
      if (key === 'delete') props.onDelete()
      else props.onRunAction(key)
    }

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
        data-testid="service-detail-action-bar"
      >
        {service.repositoryId ? (
          <BranchSelector
            serviceId={service.id}
            currentBranch={service.currentBranch}
            isCloned={service.cloneStatus === 'cloned'}
          />
        ) : null}
        <ButtonGroup>
          {primary.apiAction ? (
            <Button
              variant="contained"
              size="small"
              color={primary.color === 'secondary' ? undefined : primary.color}
              startIcon={primary.icon}
              loading={!!actionInProgress}
              disabled={!!actionInProgress}
              onclick={() => props.onRunAction(primary.apiAction)}
            >
              {primary.label}
            </Button>
          ) : null}
          <Button
            variant="outlined"
            size="small"
            onclick={props.onEdit}
            startIcon={<Icon icon={icons.edit} size="small" />}
          >
            Edit
          </Button>
        </ButtonGroup>
        <Dropdown items={dropdownItems} disabled={!!actionInProgress} onSelect={handleDropdownSelect}>
          <Button variant="outlined" size="small" startIcon={<Icon icon={icons.moreVertical} size="small" />}>
            More
          </Button>
        </Dropdown>
      </div>
    )
  },
})
