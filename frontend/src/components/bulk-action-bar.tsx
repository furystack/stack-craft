import { createComponent, Shade } from '@furystack/shades'
import type { CollectionService } from '@furystack/shades-common-components'
import { Button, ButtonGroup, Icon, icons, NotyService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { bulkApplyFiles } from './bulk-actions.js'

type BulkActionBarProps = {
  collectionService: CollectionService<ServiceView>
}

export const BulkActionBar = Shade<BulkActionBarProps>({
  customElementName: 'shade-bulk-action-bar',
  render: ({ props, injector, useObservable, useState }) => {
    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)

    const [selection] = useObservable('selection', props.collectionService.selection)
    const [isBulkLoading, setIsBulkLoading] = useState('isBulkLoading', false)

    if (selection.length === 0) return <></>

    const hasRunning = selection.some((s) => s.runStatus === 'running')
    const hasStopped = selection.some((s) => s.runStatus !== 'running')

    const bulkAction = async (action: 'start' | 'stop' | 'restart' | 'setup' | 'update') => {
      setIsBulkLoading(true)
      const targets = selection.filter((svc) => {
        if (action === 'start') return svc.runStatus !== 'running'
        if (action === 'stop') return svc.runStatus === 'running'
        return true
      })
      const failures: string[] = []
      for (const svc of targets) {
        try {
          await api.call({
            method: 'POST',
            action: `/services/:id/${action}`,
            url: { id: svc.id },
          })
        } catch {
          failures.push(svc.displayName)
        }
      }
      if (failures.length > 0) {
        noty.emit('onNotyAdded', {
          title: `${action} failed`,
          body: `Failed for: ${failures.join(', ')}`,
          type: 'error',
        })
      }
      setIsBulkLoading(false)
    }

    const handleBulkApplyFiles = async () => {
      setIsBulkLoading(true)
      try {
        await bulkApplyFiles(injector, noty, selection)
      } finally {
        setIsBulkLoading(false)
      }
    }

    return (
      <ButtonGroup variant="outlined">
        {hasStopped ? (
          <Button
            size="small"
            color="success"
            loading={isBulkLoading}
            onclick={() => void bulkAction('start')}
            startIcon={<Icon icon={icons.play} size="small" />}
          >
            Start
          </Button>
        ) : null}
        {hasRunning ? (
          <Button
            size="small"
            loading={isBulkLoading}
            onclick={() => void bulkAction('stop')}
            startIcon={<Icon icon={icons.stopCircle} size="small" />}
          >
            Stop
          </Button>
        ) : null}
        <Button
          size="small"
          loading={isBulkLoading}
          title="Clone, install, and build (initial provisioning)"
          onclick={() => void bulkAction('setup')}
          startIcon={<Icon icon={icons.settings} size="small" />}
        >
          Set Up
        </Button>
        {hasRunning ? (
          <Button
            size="small"
            color="warning"
            loading={isBulkLoading}
            onclick={() => void bulkAction('restart')}
            startIcon={<Icon icon={icons.refresh} size="small" />}
          >
            Restart
          </Button>
        ) : null}
        <Button
          size="small"
          loading={isBulkLoading}
          title="Pull, install, build, and restart if running"
          onclick={() => void bulkAction('update')}
          startIcon={<Icon icon={icons.download} size="small" />}
        >
          Update
        </Button>
        <Button
          size="small"
          loading={isBulkLoading}
          title="Re-write all shared and local files to disk for the selected services (e.g. after editing stack environment variables)"
          onclick={() => void handleBulkApplyFiles()}
          startIcon={<Icon icon={icons.fileText} size="small" />}
        >
          Apply Files
        </Button>
      </ButtonGroup>
    )
  },
})
