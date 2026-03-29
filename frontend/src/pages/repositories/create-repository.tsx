import { createComponent, Shade } from '@furystack/shades'

import { NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import type { GitHubRepository } from 'common'

import { stackCraftNavigate } from '../../components/app-routes.js'
import { GitHubRepoForm } from '../../components/entity-forms/github-repo-form.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'

type CreateRepositoryProps = {
  stackName: string
}

export const CreateRepository = Shade<CreateRepositoryProps>({
  customElementName: 'shade-create-repository',
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
        stackCraftNavigate(injector, '/stacks/:stackName/repositories', { stackName: props.stackName })
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
            onCancel={() =>
              stackCraftNavigate(injector, '/stacks/:stackName/repositories', { stackName: props.stackName })
            }
          />
        </Paper>
      </PageContainer>
    )
  },
})
