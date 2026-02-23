import { createComponent, Shade } from '@furystack/shades'
import { Button, Chip, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import type { Prerequisite } from 'common'

import { PrerequisitesApiClient } from '../services/api-clients/prerequisites-api-client.js'
import type { PrerequisiteCheckStatus } from './status-chips.js'
import { PrerequisiteCheckChip, PrerequisiteTypeChip } from './status-chips.js'

type CheckState = {
  status: PrerequisiteCheckStatus
  output?: string
}

type PrerequisiteListProps = {
  prerequisites: Prerequisite[]
  onCheck?: (id: string) => void
}

export const PrerequisiteList = Shade<PrerequisiteListProps>({
  shadowDomName: 'shade-prerequisite-list',
  render: ({ props, injector, useState }) => {
    const [checkStates, setCheckStates] = useState<Record<string, CheckState>>('checkStates', {})

    const api = injector.getInstance(PrerequisitesApiClient)

    const runCheck = async (prereq: Prerequisite) => {
      setCheckStates({ ...checkStates, [prereq.id]: { status: 'checking' } })
      try {
        const { result } = await api.call({
          method: 'POST',
          action: '/prerequisites/:id/check',
          url: { id: prereq.id },
        })
        setCheckStates({
          ...checkStates,
          [prereq.id]: { status: result.satisfied ? 'satisfied' : 'failed', output: result.output },
        })
      } catch (error) {
        setCheckStates({
          ...checkStates,
          [prereq.id]: { status: 'failed', output: error instanceof Error ? error.message : 'Check failed' },
        })
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

    const allSatisfied = props.prerequisites.every((p) => checkStates[p.id]?.status === 'satisfied')
    const anyFailed = props.prerequisites.some((p) => checkStates[p.id]?.status === 'failed')
    const anyChecking = props.prerequisites.some((p) => checkStates[p.id]?.status === 'checking')

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
          const state = checkStates[prereq.id] ?? { status: 'unchecked' as const }
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
              <PrerequisiteCheckChip status={state.status} />
              <Button
                variant="text"
                size="small"
                loading={state.status === 'checking'}
                onclick={() => void runCheck(prereq)}
                startIcon={<Icon icon={icons.refresh} size="small" />}
              >
                Check
              </Button>
              {state.output ? (
                <span
                  title={state.output}
                  style={{
                    fontSize: '12px',
                    opacity: '0.7',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {state.output}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  },
})
