import type { RestApi } from '@furystack/rest'
import type { User } from '../models/user.js'

export type IsAuthenticatedAction = { result: { isAuthenticated: boolean } }
export type GetCurrentUserAction = { result: User }
export type LoginAction = { result: User; body: { username: string; password: string } }
export type LogoutAction = { result: unknown }

export type PasswordResetAction = {
  result: { success: boolean }
  body: {
    currentPassword: string
    newPassword: string
  }
}

export interface IdentityApi extends RestApi {
  GET: {
    '/isAuthenticated': IsAuthenticatedAction
    '/currentUser': GetCurrentUserAction
  }
  POST: {
    '/login': LoginAction
    '/logout': LogoutAction
    '/password-reset': PasswordResetAction
  }
}
