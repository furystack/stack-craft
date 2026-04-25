import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { GitHubRepositoriesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class GitHubReposApiClientImpl {
  public call = createClient<GitHubRepositoriesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/github-repositories`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type GitHubReposApiClient = GitHubReposApiClientImpl

export const GitHubReposApiClient: Token<GitHubReposApiClient, 'singleton'> = defineService({
  name: 'app/GitHubReposApiClient',
  lifetime: 'singleton',
  factory: () => new GitHubReposApiClientImpl(),
})
