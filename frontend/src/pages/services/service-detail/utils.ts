import type { Injector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'
import type { GitHubRepository, Prerequisite, ServiceView } from 'common'

import { stackCraftNavigate } from '../../../components/app-routes.js'
import { GitHubReposApiClient } from '../../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'

export const runServiceAction = async (
  injector: Injector,
  serviceId: string,
  apiAction: string,
  setActionInProgress: (v: string | null) => void,
): Promise<void> => {
  const api = injector.getInstance(ServicesApiClient)
  const noty = injector.getInstance(NotyService)
  setActionInProgress(apiAction)
  try {
    await api.call({
      method: 'POST',
      action: apiAction as '/services/:id/start',
      url: { id: serviceId },
    })
  } catch (error) {
    const label = apiAction.split('/').pop() ?? apiAction
    noty.emit('onNotyAdded', {
      title: `${label} failed`,
      body: error instanceof Error ? error.message : `Failed to execute ${label}`,
      type: 'error',
    })
  } finally {
    setActionInProgress(null)
  }
}

export const saveService = async (
  injector: Injector,
  serviceId: string,
  data: Partial<ServiceView>,
  currentDisplayName: string,
): Promise<boolean> => {
  const api = injector.getInstance(ServicesApiClient)
  const noty = injector.getInstance(NotyService)
  try {
    await api.call({
      method: 'PATCH',
      action: '/services/:id',
      url: { id: serviceId },
      body: {
        displayName: data.displayName,
        description: data.description,
        workingDirectory: data.workingDirectory,
        repositoryId: data.repositoryId,
        runCommand: data.runCommand,
        installCommand: data.installCommand,
        buildCommand: data.buildCommand,
        autoFetchEnabled: data.autoFetchEnabled,
        autoFetchIntervalMinutes: data.autoFetchIntervalMinutes,
        autoRestartOnFetch: data.autoRestartOnFetch,
        prerequisiteIds: data.prerequisiteIds,
        prerequisiteServiceIds: data.prerequisiteServiceIds,
        files: data.files,
        localFiles: data.localFiles,
      },
    })
    noty.emit('onNotyAdded', {
      title: 'Service updated',
      body: `"${data.displayName ?? currentDisplayName}" was updated successfully.`,
      type: 'success',
    })
    return true
  } catch (error) {
    noty.emit('onNotyAdded', {
      title: 'Error',
      body: error instanceof Error ? error.message : 'Failed to update service',
      type: 'error',
    })
    return false
  }
}

export const deleteService = async (
  injector: Injector,
  serviceId: string,
  displayName: string,
  stackName: string,
): Promise<void> => {
  const api = injector.getInstance(ServicesApiClient)
  const noty = injector.getInstance(NotyService)
  try {
    await api.call({
      method: 'DELETE',
      action: '/services/:id',
      url: { id: serviceId },
    })
    noty.emit('onNotyAdded', {
      title: 'Service deleted',
      body: `"${displayName}" was deleted.`,
      type: 'success',
    })
    stackCraftNavigate(injector, '/stacks/:stackName/services', { stackName })
  } catch (error) {
    noty.emit('onNotyAdded', {
      title: 'Error',
      body: error instanceof Error ? error.message : 'Failed to delete service',
      type: 'error',
    })
  }
}

export const createPrerequisite = async (
  injector: Injector,
  stackName: string,
  data: Partial<Prerequisite>,
): Promise<string> => {
  const prereqsApi = injector.getInstance(PrerequisitesApiClient)
  const noty = injector.getInstance(NotyService)
  const newId = crypto.randomUUID()
  await prereqsApi.call({
    method: 'POST',
    action: '/prerequisites',
    body: {
      id: newId,
      stackName,
      name: data.name!,
      type: data.type!,
      config: data.config!,
      installationHelp: data.installationHelp ?? '',
    },
  })
  noty.emit('onNotyAdded', { title: 'Prerequisite added', body: `"${data.name}" was added.`, type: 'success' })
  return newId
}

export const createRepository = async (
  injector: Injector,
  stackName: string,
  data: Partial<GitHubRepository>,
): Promise<string> => {
  const reposApi = injector.getInstance(GitHubReposApiClient)
  const noty = injector.getInstance(NotyService)
  const newId = crypto.randomUUID()
  await reposApi.call({
    method: 'POST',
    action: '/github-repositories',
    body: {
      id: newId,
      stackName,
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

export const applyServiceFiles = async (
  injector: Injector,
  serviceId: string,
  setActionInProgress: (v: string | null) => void,
  relativePath?: string,
): Promise<void> => {
  const api = injector.getInstance(ServicesApiClient)
  const noty = injector.getInstance(NotyService)
  const key = relativePath ? `apply-file-${relativePath}` : 'apply-files-all'
  setActionInProgress(key)
  try {
    await api.call({
      method: 'POST',
      action: '/services/:id/apply-files',
      url: { id: serviceId },
      body: relativePath ? { relativePath } : {},
    })
    noty.emit('onNotyAdded', {
      title: 'Files applied',
      body: relativePath ? `${relativePath} was written to disk.` : 'All shared files were written to disk.',
      type: 'success',
    })
  } catch (error) {
    noty.emit('onNotyAdded', {
      title: 'Error',
      body: error instanceof Error ? error.message : 'Failed to apply files',
      type: 'error',
    })
  } finally {
    setActionInProgress(null)
  }
}
