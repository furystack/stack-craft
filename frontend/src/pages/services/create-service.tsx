import { createComponent, Shade } from '@furystack/shades'
import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { Service } from 'common'

import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type CreateServiceProps = {
  stackName: string
}

export const CreateService = Shade<CreateServiceProps>({
  shadowDomName: 'shade-create-service',
  render: ({ props, injector }) => {
    const handleSubmit = async (data: Partial<Service>) => {
      try {
        await injector.getInstance(ServicesApiClient).call({
          method: 'POST',
          action: '/services',
          body: {
            id: crypto.randomUUID(),
            stackName: props.stackName,
            displayName: data.displayName!,
            description: data.description ?? '',
            workingDirectory: data.workingDirectory!,
            runCommand: data.runCommand!,
            installCommand: data.installCommand,
            buildCommand: data.buildCommand,
            autoFetchEnabled: data.autoFetchEnabled ?? false,
            autoFetchIntervalMinutes: data.autoFetchIntervalMinutes ?? 60,
            autoRestartOnFetch: data.autoRestartOnFetch ?? false,
            dependencyIds: [],
            prerequisiteServiceIds: [],
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Service created',
          body: `Service "${data.displayName}" was created successfully.`,
          type: 'success',
        })
        history.pushState(null, '', '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to create service',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader
          icon="➕"
          title="Create Service"
          description={`Add a new service to the "${props.stackName}" stack.`}
        />
        <Paper>
          <ServiceForm
            mode="create"
            stackName={props.stackName}
            onSubmit={(data) => void handleSubmit(data)}
            onCancel={() => history.pushState(null, '', '/')}
          />
        </Paper>
      </PageContainer>
    )
  },
})
