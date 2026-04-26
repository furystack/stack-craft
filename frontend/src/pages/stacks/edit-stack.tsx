import { useEntitySync } from '../../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'

import {
  Button,
  ConfirmDialog,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { EnvironmentVariableValue, StackView } from 'common'
import { StackConfig, StackDefinition } from 'common'
import { stackCraftNavigate } from '../../components/app-routes.js'
import { StackForm } from '../../components/entity-forms/stack-form.js'
import { EnvironmentVariablesManager } from '../../components/environment-variables-manager.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type EditStackProps = {
  stackName: string
}

export const EditStack = Shade<EditStackProps>({
  customElementName: 'shade-edit-stack',
  render: (options) => {
    const { props, injector, useState } = options
    const [isConfirmingDelete, setIsConfirmingDelete] = useState('isConfirmingDelete', false)

    const stackState = useEntitySync(options, StackDefinition, props.stackName)
    const configState = useEntitySync(options, StackConfig, props.stackName)

    if (stackState.status === 'connecting' || configState.status === 'connecting') {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    if (stackState.status === 'error' || configState.status === 'error') {
      const errorMsg =
        stackState.status === 'error' ? stackState.error : configState.status === 'error' ? configState.error : ''
      return (
        <PageContainer>
          <PageHeader title="Error loading stack" description={errorMsg} />
        </PageContainer>
      )
    }

    const stackDef = stackState.data
    const stackConfig =
      configState.status === 'synced' || configState.status === 'cached' ? configState.data : undefined
    const stack = stackDef
      ? ({ ...stackDef, stackName: stackDef.name, mainDirectory: stackConfig?.mainDirectory ?? '' } as StackView)
      : undefined
    if (!stack) {
      return (
        <PageContainer>
          <PageHeader title="Stack not found" />
        </PageContainer>
      )
    }

    const api = injector.get(StacksApiClient)
    const [isDeleting, setIsDeleting] = useState('isDeleting', false)

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
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Stack updated',
          body: `"${data.displayName ?? stack.displayName}" was updated successfully.`,
          type: 'success',
        })
        stackCraftNavigate(injector, { path: '/stacks/:stackName', params: { stackName: stack.name } })
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to update stack',
          type: 'error',
        })
      }
    }

    const handleDelete = async () => {
      setIsDeleting(true)
      try {
        await api.call({
          method: 'DELETE',
          action: '/stacks/:id',
          url: { id: stack.name },
        })
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Stack deleted',
          body: `"${stack.displayName}" was deleted.`,
          type: 'success',
        })
        stackCraftNavigate(injector, { path: '/' })
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete stack',
          type: 'error',
        })
        setIsDeleting(false)
      }
    }

    return (
      <PageContainer>
        <PageHeader
          title={`Edit: ${stack.displayName}`}
          actions={
            <Button
              variant="outlined"
              size="small"
              color="error"
              data-testid="delete-stack-button"
              loading={isDeleting}
              onclick={() => setIsConfirmingDelete(true)}
              startIcon={<Icon icon={icons.trash} size="small" />}
            >
              Delete Stack
            </Button>
          }
        />
        <Paper>
          <StackForm
            mode="edit"
            initial={stack}
            onSubmit={(data) => void handleSave(data)}
            onCancel={() =>
              stackCraftNavigate(injector, { path: '/stacks/:stackName', params: { stackName: stack.name } })
            }
          />
        </Paper>
        <EnvironmentVariablesManager
          stackName={stack.name}
          environmentVariables={stackConfig?.environmentVariables ?? {}}
          onSave={(updated: Record<string, EnvironmentVariableValue>) => {
            void api
              .call({
                method: 'PATCH',
                action: '/stacks/:id',
                url: { id: stack.name },
                body: { environmentVariables: updated },
              })
              .then(() => {
                injector.get(NotyService).emit('onNotyAdded', {
                  title: 'Environment variables saved',
                  body: 'Stack environment variables were updated.',
                  type: 'success',
                })
              })
              .catch((error: unknown) => {
                injector.get(NotyService).emit('onNotyAdded', {
                  title: 'Error',
                  body: error instanceof Error ? error.message : 'Failed to save environment variables',
                  type: 'error',
                })
              })
          }}
        />
        {ConfirmDialog(isConfirmingDelete, {
          title: 'Delete Stack',
          message: `Are you sure you want to delete "${stack.displayName}"? All services, repositories, and prerequisites in this stack will be removed. This action cannot be undone.`,
          confirmText: 'Delete',
          onConfirm: () => void handleDelete(),
          onCancel: () => setIsConfirmingDelete(false),
        })}
      </PageContainer>
    )
  },
})
