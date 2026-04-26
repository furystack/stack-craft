import { useCollectionSync } from '../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme } from '@furystack/shades-common-components'
import type { Prerequisite } from 'common'
import { PrerequisiteCheckResult } from 'common'

import { PrerequisiteSummaryChip } from './prerequisite-summary-chip.js'
import { PrerequisiteTypeChip } from './status-chips.js'

type PrerequisiteListProps = {
  prerequisites: Prerequisite[]
}

export const PrerequisiteList = Shade<PrerequisiteListProps>({
  customElementName: 'shade-prerequisite-list',
  render: (options) => {
    const { props } = options

    const checkResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const checkResults =
      checkResultsState.status === 'synced' || checkResultsState.status === 'cached'
        ? checkResultsState.data.entries
        : []
    const checkResultMap = new Map(checkResults.map((r) => [r.prerequisiteId, r]))

    if (props.prerequisites.length === 0) {
      return <div style={{ opacity: '0.6', padding: '8px 0', fontSize: '14px' }}>No prerequisites assigned.</div>
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {props.prerequisites.map((prereq) => {
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
              <PrerequisiteSummaryChip prerequisiteIds={[prereq.id]} />
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
