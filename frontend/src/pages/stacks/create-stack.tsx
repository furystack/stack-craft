import { createComponent, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { Stack } from 'common'
import { StackForm } from '../../components/entity-forms/stack-form.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

export const CreateStack = Shade({
  shadowDomName: 'shade-create-stack',
  render: ({ injector }) => {
    const handleSubmit = async (data: Partial<Stack>) => {
      const now = new Date().toISOString()
      try {
        await injector.getInstance(StacksApiClient).call({
          method: 'POST',
          action: '/stacks',
          body: {
            name: data.name,
            displayName: data.displayName!,
            description: data.description ?? '',
            mainDirectory: data.mainDirectory!,
            createdAt: now,
            updatedAt: now,
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Stack created',
          body: `Stack "${data.displayName}" was created successfully.`,
          type: 'success',
        })
        navigate(injector, '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to create stack',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader icon="➕" title="Create Stack" description="Set up a new stack to manage your services." />
        <Paper>
          <StackForm
            mode="create"
            onSubmit={(data) => void handleSubmit(data)}
            onCancel={() => navigate(injector, '/')}
          />
        </Paper>
      </PageContainer>
    )
  },
})
