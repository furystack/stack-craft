import { createComponent, Shade } from '@furystack/shades'

import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { StackView } from 'common'

import { stackCraftNavigate } from '../../components/app-routes.js'
import { StackForm } from '../../components/entity-forms/stack-form.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

export const CreateStack = Shade({
  customElementName: 'shade-create-stack',
  render: ({ injector }) => {
    const handleSubmit = async (data: Partial<StackView>) => {
      try {
        const createdStack = await injector.getInstance(StacksApiClient).call({
          method: 'POST',
          action: '/stacks',
          body: {
            name: data.name,
            displayName: data.displayName!,
            description: data.description ?? '',
            mainDirectory: data.mainDirectory!,
            environmentVariables: {},
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Stack created',
          body: `Stack "${data.displayName}" was created successfully.`,
          type: 'success',
        })

        stackCraftNavigate(injector, {
          path: '/stacks/:stackName',
          params: { stackName: createdStack.result.name },
        })
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
          <StackForm mode="create" onSubmit={(data) => void handleSubmit(data)} cancelHref="/" />
        </Paper>
      </PageContainer>
    )
  },
})
