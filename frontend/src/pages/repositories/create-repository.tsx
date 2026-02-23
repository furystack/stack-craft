import { createComponent, LocationService, Shade } from '@furystack/shades'

import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { GitHubRepository } from 'common'

import { GitHubRepoForm } from '../../components/entity-forms/github-repo-form.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'

type CreateRepositoryProps = {
  stackName: string
}

export const CreateRepository = Shade<CreateRepositoryProps>({
  shadowDomName: 'shade-create-repository',
  render: ({ props, injector }) => {
    const handleSubmit = async (data: Partial<GitHubRepository>) => {
      try {
        await injector.getInstance(GitHubReposApiClient).call({
          method: 'POST',
          action: '/github-repositories',
          body: {
            id: crypto.randomUUID(),
            stackName: props.stackName,
            url: data.url!,
            displayName: data.displayName!,
            description: data.description ?? '',
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Repository added',
          body: `"${data.displayName}" was added successfully.`,
          type: 'success',
        })
        injector.getInstance(LocationService).navigate('/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to add repository',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader icon="📦" title="Add Repository" description="Add a GitHub repository to this stack." />
        <Paper>
          <GitHubRepoForm
            mode="create"
            stackName={props.stackName}
            onSubmit={(data) => void handleSubmit(data)}
            cancelHref="/"
          />
        </Paper>
      </PageContainer>
    )
  },
})
