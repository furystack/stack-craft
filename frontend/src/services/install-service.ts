import { Injectable, Injected } from '@furystack/inject'
import { Cache } from '@furystack/cache'
import { InstallApiClient } from './api-clients/install-api-client.js'

@Injectable({ lifetime: 'singleton' })
export class InstallService {
  @Injected(InstallApiClient)
  declare private readonly apiClient: InstallApiClient

  private cache = new Cache({
    load: async () => {
      const { result } = await this.apiClient.call({
        method: 'GET',
        action: '/serviceStatus',
      })
      return result
    },
  })

  public getServiceStatus = this.cache.get.bind(this.cache)
  public getServiceStatusAsObservable = this.cache.getObservable.bind(this.cache)

  public [Symbol.dispose]() {
    this.cache[Symbol.dispose]()
  }
}
