import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import { GitHubRepository } from 'common'

import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type CreateServiceProps = {
  stackName: string
}

export const CreateService = Shade<CreateServiceProps>({
  shadowDomName: 'shade-create-service',
  render: (options) => {
    const { props, injector } = options

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []
    const handleSubmit = async (data: Partial<ServiceView>) => {
      try {
        await injector.getInstance(ServicesApiClient).call({
          method: 'POST',
          action: '/services',
          body: {
            id: crypto.randomUUID(),
            stackName: props.stackName,
            displayName: data.displayName!,
            description: data.description ?? '',
            workingDirectory: data.workingDirectory || undefined,
            runCommand: data.runCommand!,
            installCommand: data.installCommand,
            buildCommand: data.buildCommand,
            autoFetchEnabled: data.autoFetchEnabled ?? false,
            autoFetchIntervalMinutes: data.autoFetchIntervalMinutes ?? 60,
            repositoryId: data.repositoryId,
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
        navigate(injector, '/')
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
            repositories={repos}
            onSubmit={(data) => void handleSubmit(data)}
            cancelHref="/"
          />
        </Paper>
      </PageContainer>
    )
  },
})
