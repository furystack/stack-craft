import { useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
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
import type { GitHubRepository } from 'common'
import { GitHubRepository as GitHubRepositoryModel } from 'common'

import { ConfirmDialog } from '../../components/confirm-dialog.js'
import { GitHubRepoForm } from '../../components/entity-forms/github-repo-form.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'

type EditRepositoryProps = {
  repositoryId: string
}

export const EditRepository = Shade<EditRepositoryProps>({
  shadowDomName: 'shade-edit-repository',
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
          <PageHeader
            title="Error loading repository"
            description={repoState.error}
            actions={
              <Button
                variant="outlined"
                onclick={() => history.pushState(null, '', '/')}
                startIcon={<Icon icon={icons.chevronLeft} size="small" />}
              >
                Back
              </Button>
            }
          />
        </PageContainer>
      )
    }

    const repo = repoState.data
    if (!repo) {
      return (
        <PageContainer>
          <PageHeader
            title="Repository not found"
            actions={
              <Button
                variant="outlined"
                onclick={() => history.pushState(null, '', '/')}
                startIcon={<Icon icon={icons.chevronLeft} size="small" />}
              >
                Back
              </Button>
            }
          />
        </PageContainer>
      )
    }

    const api = injector.getInstance(GitHubReposApiClient)

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
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Repository updated',
          body: `"${data.displayName ?? repo.displayName}" was updated successfully.`,
          type: 'success',
        })
        history.pushState(null, '', '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to update repository',
          type: 'error',
        })
      }
    }

    const handleDelete = async () => {
      try {
        await api.call({
          method: 'DELETE',
          action: '/github-repositories/:id',
          url: { id: repo.id },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Repository deleted',
          body: `"${repo.displayName}" was deleted.`,
          type: 'success',
        })
        history.pushState(null, '', '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete repository',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader
          title={`Edit: ${repo.displayName}`}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outlined"
                onclick={() => history.pushState(null, '', '/')}
                startIcon={<Icon icon={icons.chevronLeft} size="small" />}
              >
                Back
              </Button>
              <Button variant="outlined" color="error" onclick={() => setIsConfirmingDelete(true)}>
                Delete
              </Button>
            </div>
          }
        />
        <Paper>
          <GitHubRepoForm
            mode="edit"
            stackName={repo.stackName}
            initial={repo}
            onSubmit={(data) => void handleSave(data)}
            onCancel={() => history.pushState(null, '', '/')}
          />
        </Paper>
        {isConfirmingDelete ? (
          <ConfirmDialog
            title="Delete Repository"
            message={`Are you sure you want to delete "${repo.displayName}"? This action cannot be undone.`}
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
