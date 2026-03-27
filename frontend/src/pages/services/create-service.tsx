import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import { GitHubRepository, Prerequisite, ServiceDefinition } from 'common'

import { stackCraftNavigate } from '../../components/app-routes.js'
import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type CreateServiceProps = {
  stackName: string
}

export const CreateService = Shade<CreateServiceProps>({
  customElementName: 'shade-create-service',
  render: (options) => {
    const { props, injector } = options

    const noty = injector.getInstance(NotyService)
    const servicesApi = injector.getInstance(ServicesApiClient)
    const prereqsApi = injector.getInstance(PrerequisitesApiClient)
    const reposApi = injector.getInstance(GitHubReposApiClient)

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []

    const prereqsState = useCollectionSync(options, Prerequisite, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const prereqs =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []

    const servicesState = useCollectionSync(options, ServiceDefinition, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const otherServices =
      servicesState.status === 'synced' || servicesState.status === 'cached' ? servicesState.data.entries : []

    const handleSubmit = async (data: Partial<ServiceView>) => {
      try {
        const createdService = await servicesApi.call({
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
            prerequisiteIds: data.prerequisiteIds ?? [],
            prerequisiteServiceIds: data.prerequisiteServiceIds ?? [],
            files: data.files ?? [],
            environmentVariableOverrides: data.environmentVariableOverrides ?? {},
          },
        })
        noty.emit('onNotyAdded', {
          title: 'Service created',
          body: `Service "${data.displayName}" was created successfully.`,
          type: 'success',
        })
        stackCraftNavigate(injector, '/stacks/:stackName/services/:serviceId', {
          stackName: props.stackName,
          serviceId: createdService.result.id,
        })
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to create service',
          type: 'error',
        })
      }
    }

    const handleCreatePrerequisite = async (data: Partial<Prerequisite>): Promise<string> => {
      const newId = crypto.randomUUID()
      await prereqsApi.call({
        method: 'POST',
        action: '/prerequisites',
        body: {
          id: newId,
          stackName: props.stackName,
          name: data.name!,
          type: data.type!,
          config: data.config!,
          installationHelp: data.installationHelp ?? '',
        },
      })
      noty.emit('onNotyAdded', { title: 'Prerequisite added', body: `"${data.name}" was added.`, type: 'success' })
      return newId
    }

    const handleCreateRepository = async (data: Partial<GitHubRepository>): Promise<string> => {
      const newId = crypto.randomUUID()
      await reposApi.call({
        method: 'POST',
        action: '/github-repositories',
        body: {
          id: newId,
          stackName: props.stackName,
          url: data.url!,
          displayName: data.displayName!,
          description: data.description ?? '',
        },
      })
      noty.emit('onNotyAdded', {
        title: 'Repository added',
        body: `"${data.displayName}" was added.`,
        type: 'success',
      })
      return newId
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
            prerequisites={prereqs}
            otherServices={otherServices}
            onSubmit={(data: Partial<ServiceView>) => void handleSubmit(data)}
            onCreatePrerequisite={(data: Partial<Prerequisite>) => handleCreatePrerequisite(data)}
            onCreateRepository={(data: Partial<GitHubRepository>) => handleCreateRepository(data)}
            onCancel={() => stackCraftNavigate(injector, '/stacks/:stackName/services', { stackName: props.stackName })}
          />
        </Paper>
      </PageContainer>
    )
  },
})
