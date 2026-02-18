import type { RestApi } from '@furystack/rest'

export type ServiceStatus = 'needsInstall' | 'installed'

export type ServiceStatusResponse = {
  state: ServiceStatus
}

export type GetServiceStatusAction = { result: ServiceStatusResponse }

export type InstallAction = { result: { success: boolean }; body: { username: string; password: string } }

export interface InstallApi extends RestApi {
  GET: {
    '/serviceStatus': GetServiceStatusAction
  }
  POST: {
    '/install': InstallAction
  }
}
