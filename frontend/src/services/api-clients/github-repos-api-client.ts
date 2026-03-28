import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { GitHubRepositoriesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class GitHubReposApiClient {
  public call = createClient<GitHubRepositoriesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/github-repositories`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
