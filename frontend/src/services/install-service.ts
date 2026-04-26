import { defineService, type Token } from '@furystack/inject'
import { Cache } from '@furystack/cache'
import { InstallApiClient } from './api-clients/install-api-client.js'

class InstallServiceImpl {
  constructor(private readonly apiClient: InstallApiClient) {}

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

export type InstallService = InstallServiceImpl

export const InstallService: Token<InstallService, 'singleton'> = defineService({
  name: 'app/InstallService',
  lifetime: 'singleton',
  factory: ({ inject, onDispose }) => {
    const service = new InstallServiceImpl(inject(InstallApiClient))
    // eslint-disable-next-line furystack/prefer-using-wrapper -- onDispose ties teardown to the injector lifetime; the instance escapes via return.
    onDispose(() => service[Symbol.dispose]())
    return service
  },
})
