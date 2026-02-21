import { useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
import {
  Button,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { StackView } from 'common'
import { StackDefinition } from 'common'

import { ConfirmDialog } from '../../components/confirm-dialog.js'
import { StackForm } from '../../components/entity-forms/stack-form.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type EditStackProps = {
  stackName: string
}

export const EditStack = Shade<EditStackProps>({
  shadowDomName: 'shade-edit-stack',
  render: (options) => {
    const { props, injector, useState } = options
    const [isConfirmingDelete, setIsConfirmingDelete] = useState('isConfirmingDelete', false)

    const stackState = useEntitySync(options, StackDefinition, props.stackName)

    if (stackState.status === 'connecting') {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    if (stackState.status === 'error') {
      return (
        <PageContainer>
          <PageHeader
            title="Error loading stack"
            description={stackState.error}
            actions={
              <NestedRouteLink href="/">
                <Button variant="outlined" startIcon={<Icon icon={icons.chevronLeft} size="small" />}>
                  Back
                </Button>
              </NestedRouteLink>
            }
          />
        </PageContainer>
      )
    }

    const stack = stackState.data
    if (!stack) {
      return (
        <PageContainer>
          <PageHeader
            title="Stack not found"
            actions={
              <NestedRouteLink href="/">
                <Button variant="outlined" startIcon={<Icon icon={icons.chevronLeft} size="small" />}>
                  Back
                </Button>
              </NestedRouteLink>
            }
          />
        </PageContainer>
      )
    }

    const api = injector.getInstance(StacksApiClient)

    const handleSave = async (data: Partial<StackView>) => {
      try {
        await api.call({
          method: 'PATCH',
          action: '/stacks/:id',
          url: { id: stack.name },
          body: {
            displayName: data.displayName,
            description: data.description,
            mainDirectory: data.mainDirectory,
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Stack updated',
          body: `"${data.displayName ?? stack.displayName}" was updated successfully.`,
          type: 'success',
        })
        navigate(injector, '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to update stack',
          type: 'error',
        })
      }
    }

    const handleDelete = async () => {
      try {
        await api.call({
          method: 'DELETE',
          action: '/stacks/:id',
          url: { id: stack.name },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Stack deleted',
          body: `"${stack.displayName}" was deleted.`,
          type: 'success',
        })
        navigate(injector, '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete stack',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader
          title={`Edit: ${stack.displayName}`}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <NestedRouteLink href="/">
                <Button variant="outlined" startIcon={<Icon icon={icons.chevronLeft} size="small" />}>
                  Back
                </Button>
              </NestedRouteLink>
              <Button variant="outlined" color="error" onclick={() => setIsConfirmingDelete(true)}>
                Delete Stack
              </Button>
            </div>
          }
        />
        <Paper>
          <StackForm
            mode="edit"
            initial={stack}
            onSubmit={(data) => void handleSave(data)}
            cancelHref="/"
          />
        </Paper>
        {isConfirmingDelete ? (
          <ConfirmDialog
            title="Delete Stack"
            message={`Are you sure you want to delete "${stack.displayName}"? All services, repositories, and dependencies in this stack will be removed. This action cannot be undone.`}
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => void handleDelete()}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        ) : null}
      </PageContainer>
    )
  },
})
