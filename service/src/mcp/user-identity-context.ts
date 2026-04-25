import { IdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import type { User } from 'common'

/**
 * An {@link IdentityContext} bound to a specific authenticated user.
 *
 * Unlike `useSystemIdentityContext`, authorization checks resolve against
 * the user's actual roles.
 */
export class UserIdentityContext implements IdentityContext {
  constructor(private readonly user: User) {}

  isAuthenticated = (): Promise<boolean> => Promise.resolve(true)

  isAuthorized = (...roles: string[]): Promise<boolean> =>
    Promise.resolve(roles.every((r) => this.user.roles.includes(r)))

  getCurrentUser = <TUser>(): Promise<TUser> => Promise.resolve(this.user as TUser)
}

/**
 * Creates a child injector with an {@link IdentityContext} bound to the given user.
 * The returned injector is {@link AsyncDisposable} — dispose it when the session ends.
 */
export const useUserIdentityContext = (options: { injector: Injector; user: User }): Injector => {
  const ctx = new UserIdentityContext(options.user)
  const child = options.injector.createScope({ owner: 'UserIdentityContext' })
  child.bind(IdentityContext, () => ctx)
  return child
}
