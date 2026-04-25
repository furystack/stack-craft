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
import type { GitHubRepository } from 'common'
import { GitHubRepository as GitHubRepositoryModel } from 'common'
import { stackCraftNavigate } from '../../components/app-routes.js'
import { GitHubRepoForm } from '../../components/entity-forms/github-repo-form.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'

type EditRepositoryProps = {
  stackName: string
  repositoryId: string
}

export const EditRepository = Shade<EditRepositoryProps>({
  customElementName: 'shade-edit-repository',
  render: (options) => {
    const { props, injector, useState } = options
    const [isConfirmingDelete, setIsConfirmingDelete] = useState('isConfirmingDelete', false)

    const repoState = useEntitySync(options, GitHubRepositoryModel, props.repositoryId)

    if (repoState.status === 'connecting') {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    if (repoState.status === 'error') {
      return (
        <PageContainer>
          <PageHeader title="Error loading repository" description={repoState.error} />
        </PageContainer>
      )
    }

    const repo = repoState.data
    if (!repo) {
      return (
        <PageContainer>
          <PageHeader title="Repository not found" />
        </PageContainer>
      )
    }

    const api = injector.get(GitHubReposApiClient)
    const [isDeleting, setIsDeleting] = useState('isDeleting', false)

    const handleSave = async (data: Partial<GitHubRepository>) => {
      try {
        await api.call({
          method: 'PATCH',
          action: '/github-repositories/:id',
          url: { id: repo.id },
          body: {
            url: data.url,
            displayName: data.displayName,
            description: data.description,
          },
        })
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Repository updated',
          body: `"${data.displayName ?? repo.displayName}" was updated successfully.`,
          type: 'success',
        })
        stackCraftNavigate(injector, {
          path: '/stacks/:stackName/repositories',
          params: { stackName: repo.stackName },
        })
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to update repository',
          type: 'error',
        })
      }
    }

    const handleDelete = async () => {
      setIsDeleting(true)
      try {
        await api.call({
          method: 'DELETE',
          action: '/github-repositories/:id',
          url: { id: repo.id },
        })
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Repository deleted',
          body: `"${repo.displayName}" was deleted.`,
          type: 'success',
        })
        stackCraftNavigate(injector, {
          path: '/stacks/:stackName/repositories',
          params: { stackName: repo.stackName },
        })
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete repository',
          type: 'error',
        })
        setIsDeleting(false)
      }
    }

    return (
      <PageContainer>
        <PageHeader
          title={`Edit: ${repo.displayName}`}
          actions={
            <Button
              variant="outlined"
              size="small"
              color="error"
              loading={isDeleting}
              onclick={() => setIsConfirmingDelete(true)}
              startIcon={<Icon icon={icons.trash} size="small" />}
            >
              Delete
            </Button>
          }
        />
        <Paper>
          <GitHubRepoForm
            mode="edit"
            stackName={repo.stackName}
            initial={repo}
            onSubmit={(data) => void handleSave(data)}
            onCancel={() =>
              stackCraftNavigate(injector, {
                path: '/stacks/:stackName/repositories',
                params: { stackName: repo.stackName },
              })
            }
          />
        </Paper>
        {ConfirmDialog(isConfirmingDelete, {
          title: 'Delete Repository',
          message: `Are you sure you want to delete "${repo.displayName}"? This action cannot be undone.`,
          confirmText: 'Delete',
          onConfirm: () => void handleDelete(),
          onCancel: () => setIsConfirmingDelete(false),
        })}
      </PageContainer>
    )
  },
})
