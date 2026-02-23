import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import { Button, Chip, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import type { Prerequisite, PrerequisiteCheckStatus } from 'common'
import { PrerequisiteCheckResult } from 'common'

import { PrerequisitesApiClient } from '../services/api-clients/prerequisites-api-client.js'
import { PrerequisiteCheckChip, PrerequisiteTypeChip } from './status-chips.js'

type PrerequisiteListProps = {
  prerequisites: Prerequisite[]
}

export const PrerequisiteList = Shade<PrerequisiteListProps>({
  shadowDomName: 'shade-prerequisite-list',
  render: (options) => {
    const { props, injector, useState } = options
    const api = injector.getInstance(PrerequisitesApiClient)

    const [checkingIds, setCheckingIds] = useState<Set<string>>('checkingIds', new Set())

    const checkResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const checkResults =
      checkResultsState.status === 'synced' || checkResultsState.status === 'cached'
        ? checkResultsState.data.entries
        : []

    const checkResultMap = new Map(checkResults.map((r) => [r.prerequisiteId, r]))

    const getStatus = (id: string): PrerequisiteCheckStatus => {
      if (checkingIds.has(id)) return 'checking'
      return checkResultMap.get(id)?.status ?? 'unchecked'
    }

    const runCheck = async (prereq: Prerequisite) => {
      setCheckingIds(new Set([...checkingIds, prereq.id]))
      try {
        await api.call({
          method: 'POST',
          action: '/prerequisites/:id/check',
          url: { id: prereq.id },
        })
      } catch {
        // Error state will arrive via entity sync
      } finally {
        const next = new Set(checkingIds)
        next.delete(prereq.id)
        setCheckingIds(next)
      }
    }

    const runCheckAll = async () => {
      for (const prereq of props.prerequisites) {
        await runCheck(prereq)
      }
    }

    if (props.prerequisites.length === 0) {
      return <div style={{ opacity: '0.6', padding: '8px 0', fontSize: '14px' }}>No prerequisites assigned.</div>
    }

    const statuses = props.prerequisites.map((p) => getStatus(p.id))
    const allSatisfied = statuses.every((s) => s === 'satisfied')
    const anyFailed = statuses.some((s) => s === 'failed')
    const anyChecking = statuses.some((s) => s === 'checking')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Button
            variant="outlined"
            size="small"
            loading={anyChecking}
            onclick={() => void runCheckAll()}
            startIcon={<Icon icon={icons.check} size="small" />}
          >
            Check All
          </Button>
          {allSatisfied && props.prerequisites.length > 0 ? (
            <Chip variant="outlined" color="success" size="small">
              ✓ All satisfied
            </Chip>
          ) : null}
          {anyFailed ? (
            <Chip variant="outlined" color="error" size="small">
              ✗ Some failed
            </Chip>
          ) : null}
        </div>
        {props.prerequisites.map((prereq) => {
          const status = getStatus(prereq.id)
          const result = checkResultMap.get(prereq.id)
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${cssVariableTheme.divider}`,
                fontSize: '14px',
              }}
            >
              <span style={{ fontWeight: '500', minWidth: '140px' }}>{prereq.name}</span>
              <PrerequisiteTypeChip type={prereq.type} />
              <div style={{ flex: '1' }} />
              <PrerequisiteCheckChip status={status} />
              <Button
                variant="text"
                size="small"
                loading={status === 'checking'}
                onclick={() => void runCheck(prereq)}
                startIcon={<Icon icon={icons.refresh} size="small" />}
              >
                Check
              </Button>
              {result?.output ? (
                <span
                  title={result.output}
                  style={{
                    fontSize: '12px',
                    opacity: '0.7',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {result.output}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  },
})
