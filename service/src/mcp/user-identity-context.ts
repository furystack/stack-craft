import { IdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import type { User } from 'common'

/**
 * An {@link IdentityContext} bound to a specific authenticated user.
 * Unlike {@link import('@furystack/core').SystemIdentityContext}, authorization
 * checks are performed against the user's actual roles.
 */
export class UserIdentityContext extends IdentityContext {
  constructor(private readonly user: User) {
    super()
  }

  override isAuthenticated = () => Promise.resolve(true)

  override isAuthorized = (...roles: string[]) => Promise.resolve(roles.every((r) => this.user.roles.includes(r)))

  override getCurrentUser = <TUser>() => Promise.resolve(this.user as TUser)
}

/**
 * Creates a child injector with an {@link IdentityContext} bound to the given user.
 * The returned injector is {@link AsyncDisposable} — dispose it when the session ends.
 */
export const useUserIdentityContext = (options: { injector: Injector; user: User }): Injector => {
  const ctx = new UserIdentityContext(options.user)
  const child = options.injector.createChild({ owner: 'UserIdentityContext' })
  child.setExplicitInstance(ctx, IdentityContext)
  return child
}
