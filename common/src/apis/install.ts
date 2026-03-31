import type { RestApi } from '@furystack/rest'

export type InstallState = 'needsInstall' | 'installed'

export type InstallStateResponse = {
  state: InstallState
}

/** Returns whether the application needs initial setup or is already installed */
export type GetServiceStatusAction = { result: InstallStateResponse }

/** Performs initial application setup and creates the first admin user */
export type InstallAction = { result: { success: boolean }; body: { username: string; password: string } }

export interface InstallApi extends RestApi {
  GET: {
    '/serviceStatus': GetServiceStatusAction
  }
  POST: {
    '/install': InstallAction
  }
}
