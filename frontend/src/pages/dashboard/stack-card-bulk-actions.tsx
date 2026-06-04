import { createComponent, Shade } from '@furystack/shades'

import { Button, Icon, icons } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { runBulkServiceAction } from '../../utils/bulk-service-actions.js'

type StackCardBulkActionsProps = {
  stackServices: ServiceView[]
}

export const StackCardBulkActions = Shade<StackCardBulkActionsProps>({
  customElementName: 'stack-card-bulk-actions',
  render: ({ props, injector, useState }) => {
    const { stackServices } = props

    const running = stackServices.filter((s) => s.runStatus === 'running').length
    const stopped = stackServices.filter((s) => s.runStatus === 'stopped').length
    const errored = stackServices.filter((s) => s.runStatus === 'error').length
    const clonedCount = stackServices.filter((s) => s.repositoryId && s.cloneStatus === 'cloned').length

    const [isStartingAll, setIsStartingAll] = useState('isStartingAll', false)
    const [isStoppingAll, setIsStoppingAll] = useState('isStoppingAll', false)
    const [isUpdatingAll, setIsUpdatingAll] = useState('isUpdatingAll', false)

    const runAction = async (action: 'start' | 'stop' | 'update', setLoading: (v: boolean) => void) => {
      setLoading(true)
      try {
        await runBulkServiceAction(injector, stackServices, action)
      } finally {
        setLoading(false)
      }
    }

    return (
      <>
        <Button
          variant="text"
          size="small"
          color="success"
          disabled={stopped === 0 && errored === 0}
          loading={isStartingAll}
          onclick={() => void runAction('start', setIsStartingAll)}
          startIcon={<Icon icon={icons.play} size="small" />}
        >
          Start All
        </Button>
        <Button
          variant="text"
          size="small"
          disabled={running === 0}
          loading={isStoppingAll}
          onclick={() => void runAction('stop', setIsStoppingAll)}
          startIcon={<Icon icon={icons.stopCircle} size="small" />}
        >
          Stop All
        </Button>
        <Button
          variant="text"
          size="small"
          disabled={clonedCount === 0}
          loading={isUpdatingAll}
          onclick={() => void runAction('update', setIsUpdatingAll)}
          startIcon={<Icon icon={icons.download} size="small" />}
        >
          Update All
        </Button>
      </>
    )
  },
})
