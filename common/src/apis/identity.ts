import type { RestApi } from '@furystack/rest'
import type { User } from '../models/user.js'

/** Checks whether the current session is authenticated */
export type IsAuthenticatedAction = { result: { isAuthenticated: boolean } }

/** Returns the currently authenticated user's profile */
export type GetCurrentUserAction = { result: User }

/** Authenticates with username/password and returns the user profile */
export type LoginAction = { result: User; body: { username: string; password: string } }

/** Ends the current session */
export type LogoutAction = { result: unknown }

/** Changes the current user's password */
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
