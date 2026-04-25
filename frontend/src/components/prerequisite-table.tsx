import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  CollectionService,
  ConfirmDialog,
  cssVariableTheme,
  DataGrid,
  Icon,
  icons,
  Loader,
  NotyService,
} from '@furystack/shades-common-components'
import type { Prerequisite } from 'common'
import { Prerequisite as PrerequisiteModel } from 'common'

import { PrerequisitesApiClient } from '../services/api-clients/prerequisites-api-client.js'
import { PrerequisiteForm } from './entity-forms/prerequisite-form.js'
import { PrerequisiteSummaryChip } from './prerequisite-summary-chip.js'
import { PrerequisiteTypeChip } from './status-chips.js'

type PrerequisiteTableProps = {
  stackName: string
}

type PrerequisiteColumn = 'name' | 'type' | 'status' | 'actions'

export const PrerequisiteTable = Shade<PrerequisiteTableProps>({
  customElementName: 'shade-prerequisite-table',
  render: (options) => {
    const { props, injector, useDisposable, useState } = options

    const api = injector.get(PrerequisitesApiClient)
    const noty = injector.get(NotyService)

    const [editingId, setEditingId] = useState<string | null>('editingId', null)
    const [isCreating, setIsCreating] = useState('isCreating', false)
    const [deletingId, setDeletingId] = useState<string | null>('deletingId', null)

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<Prerequisite>({ searchField: 'name', idField: 'id' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<Prerequisite, Array<keyof Prerequisite>>>(
      'findOptionsObservable',
      { top: 25 },
    )

    const prereqsState = useCollectionSync(options, PrerequisiteModel, {
      filter: { stackName: { $eq: props.stackName } },
      top: findOptions.top,
      skip: findOptions.skip,
      order: findOptions.order,
    })

    const isLoading = prereqsState.status === 'connecting'
    const entries =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []
    const count = prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.count : 0

    collectionService.data.setValue({ entries, count })

    const handleCreate = async (data: Partial<Prerequisite>) => {
      try {
        await api.call({
          method: 'POST',
          action: '/prerequisites',
          body: {
            id: crypto.randomUUID(),
            stackName: props.stackName,
            name: data.name!,
            type: data.type!,
            config: data.config!,
            installationHelp: data.installationHelp ?? '',
          },
        })
        noty.emit('onNotyAdded', { title: 'Prerequisite added', body: `"${data.name}" was added.`, type: 'success' })
        setIsCreating(false)
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to add prerequisite',
          type: 'error',
        })
      }
    }

    const handleUpdate = async (id: string, data: Partial<Prerequisite>) => {
      try {
        await api.call({
          method: 'PATCH',
          action: '/prerequisites/:id',
          url: { id },
          body: { name: data.name, type: data.type, config: data.config, installationHelp: data.installationHelp },
        })
        noty.emit('onNotyAdded', {
          title: 'Prerequisite updated',
          body: `"${data.name}" was updated.`,
          type: 'success',
        })
        setEditingId(null)
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to update prerequisite',
          type: 'error',
        })
      }
    }

    const handleDelete = async (prereq: Prerequisite) => {
      try {
        await api.call({ method: 'DELETE', action: '/prerequisites/:id', url: { id: prereq.id } })
        noty.emit('onNotyAdded', {
          title: 'Prerequisite deleted',
          body: `"${prereq.name}" was deleted.`,
          type: 'success',
        })
        setDeletingId(null)
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete prerequisite',
          type: 'error',
        })
        setDeletingId(null)
      }
    }

    const deletingPrereq = entries.find((e) => e.id === deletingId)
    const editingPrereq = entries.find((e) => e.id === editingId)

    if (isCreating) {
      return (
        <PrerequisiteForm
          stackName={props.stackName}
          mode="create"
          onSubmit={(data) => void handleCreate(data)}
          onCancel={() => setIsCreating(false)}
        />
      )
    }

    if (editingPrereq) {
      return (
        <PrerequisiteForm
          stackName={props.stackName}
          mode="edit"
          initial={editingPrereq}
          onSubmit={(data) => void handleUpdate(editingPrereq.id, data)}
          onCancel={() => setEditingId(null)}
        />
      )
    }

    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <Loader />
        </div>
      )
    }

    if (entries.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '24px', color: cssVariableTheme.text.secondary }}>
          No prerequisites defined for this stack.
          <div style={{ marginTop: '12px' }}>
            <Button
              variant="outlined"
              size="small"
              onclick={() => setIsCreating(true)}
              startIcon={<Icon icon={icons.plus} size="small" />}
            >
              Add Prerequisite
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <Button
            variant="outlined"
            size="small"
            onclick={() => setIsCreating(true)}
            startIcon={<Icon icon={icons.plus} size="small" />}
          >
            Add Prerequisite
          </Button>
        </div>
        <DataGrid<Prerequisite, PrerequisiteColumn>
          columns={['name', 'type', 'status', 'actions']}
          findOptions={findOptions}
          onFindOptionsChange={setFindOptions}
          styles={undefined}
          collectionService={collectionService}
          headerComponents={{
            status: () => <span>Status</span>,
            actions: () => <span style={{ paddingLeft: '1em' }}>Actions</span>,
          }}
          rowComponents={{
            name: (entry) => <strong>{entry.name}</strong>,
            type: (entry) => <PrerequisiteTypeChip type={entry.type} />,
            status: (entry) => <PrerequisiteSummaryChip prerequisiteIds={[entry.id]} />,
            actions: (entry) => (
              <div
                style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
                onclick={(e: MouseEvent) => e.stopPropagation()}
              >
                <Button
                  variant="text"
                  size="small"
                  title="Edit"
                  onclick={() => setEditingId(entry.id)}
                  startIcon={<Icon icon={icons.edit} size="small" />}
                />
                <Button
                  variant="text"
                  size="small"
                  title="Delete"
                  color="error"
                  onclick={() => setDeletingId(entry.id)}
                  startIcon={<Icon icon={icons.trash} size="small" />}
                />
              </div>
            ),
          }}
        />
        {ConfirmDialog(!!deletingPrereq, {
          title: 'Delete Prerequisite',
          message: `Are you sure you want to delete "${deletingPrereq?.name}"?`,
          confirmText: 'Delete',
          onConfirm: () => void handleDelete(deletingPrereq!),
          onCancel: () => setDeletingId(null),
        })}
      </div>
    )
  },
})
