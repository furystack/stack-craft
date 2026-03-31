import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import type { Palette } from '@furystack/shades-common-components'
import { Chip, CircularProgress, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import { PrerequisiteCheckResult } from 'common'

import { PrerequisitesApiClient } from '../services/api-clients/prerequisites-api-client.js'
import { getPrerequisiteSummary } from '../utils/prerequisite-summary.js'

type PrerequisiteSummaryChipProps = {
  prerequisiteIds: string[]
}

type ChipVisual = { label: string; color: keyof Palette; icon: JSX.Element }

const getChipVisual = (
  satisfiedCount: number,
  failedCount: number,
  totalCount: number,
  isChecking: boolean,
): ChipVisual => {
  if (isChecking) {
    return { label: 'Checking…', color: 'warning', icon: <CircularProgress size={10} thickness={2} /> }
  }

  const isSingle = totalCount === 1

  if (satisfiedCount === totalCount) {
    return {
      label: isSingle ? 'Satisfied' : 'All satisfied',
      color: 'success',
      icon: <Icon icon={icons.check} size={10} />,
    }
  }
  if (isSingle && failedCount === 1) {
    return { label: 'Failed', color: 'error', icon: <Icon icon={icons.close} size={10} /> }
  }
  if (failedCount === totalCount) {
    return {
      label: `${satisfiedCount}/${totalCount} satisfied`,
      color: 'error',
      icon: <Icon icon={icons.close} size={10} />,
    }
  }
  if (isSingle) {
    return { label: 'Not checked', color: 'warning', icon: <Icon icon={icons.warning} size={10} /> }
  }
  return {
    label: `${satisfiedCount}/${totalCount} satisfied`,
    color: 'warning',
    icon: <Icon icon={icons.warning} size={10} />,
  }
}

export const PrerequisiteSummaryChip = Shade<PrerequisiteSummaryChipProps>({
  customElementName: 'shade-prerequisite-summary-chip',
  css: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVariableTheme.spacing.md,
    '& .prereq-recheck': {
      display: 'none',
    },
    '&:hover .prereq-status': {
      display: 'none',
    },
    '&:hover .prereq-recheck': {
      display: 'contents',
    },
    '&[data-checking]:hover .prereq-status': {
      display: 'contents',
    },
    '&[data-checking]:hover .prereq-recheck': {
      display: 'none',
    },
  },
  render: (options) => {
    const { props, injector, useState, useHostProps } = options

    const [isChecking, setIsChecking] = useState('isChecking', false)

    const checkResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const checkResults =
      checkResultsState.status === 'synced' || checkResultsState.status === 'cached'
        ? checkResultsState.data.entries
        : []
    const checkResultMap = new Map(checkResults.map((r) => [r.prerequisiteId, r]))

    const summary = getPrerequisiteSummary(props.prerequisiteIds, checkResultMap)
    const satisfiedCount = summary?.satisfiedCount ?? 0
    const failedCount = summary?.failedCount ?? 0

    const totalCount = props.prerequisiteIds.length
    const checkedCount = satisfiedCount + failedCount
    const { label, color, icon } = getChipVisual(satisfiedCount, failedCount, totalCount, isChecking)

    const hoverLabel =
      totalCount === 1 ? (checkedCount === 0 ? 'Check' : 'Re-check') : checkedCount === 0 ? 'Check all' : 'Re-check all'

    const handleCheckAll = async () => {
      setIsChecking(true)
      const api = injector.getInstance(PrerequisitesApiClient)
      try {
        for (const id of props.prerequisiteIds) {
          await api.call({
            method: 'POST',
            action: '/prerequisites/:id/check',
            url: { id },
          })
        }
      } finally {
        setIsChecking(false)
      }
    }

    useHostProps({
      'data-checking': isChecking ? '' : undefined,
    })

    return (
      <Chip
        variant="outlined"
        size="small"
        color={color}
        clickable={!isChecking}
        onclick={(ev: MouseEvent) => {
          ev.stopPropagation()
          if (!isChecking) void handleCheckAll()
        }}
        title={label}
      >
        <span className="prereq-status">
          {icon} {label}
        </span>
        <span className="prereq-recheck">
          <Icon icon={icons.refresh} size={12} /> {hoverLabel}
        </span>
      </Chip>
    )
  },
})
