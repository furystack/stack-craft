import type { RestApi } from '@furystack/rest'

export type InstallState = 'needsInstall' | 'installed'

export type InstallStateResponse = {
  state: InstallState
}

export type GetServiceStatusAction = { result: InstallStateResponse }

export type InstallAction = { result: { success: boolean }; body: { username: string; password: string } }

export interface InstallApi extends RestApi {
  GET: {
    '/serviceStatus': GetServiceStatusAction
  }
  POST: {
    '/install': InstallAction
  }
}
