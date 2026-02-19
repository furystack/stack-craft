import { IdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { User } from 'common'

export const SYSTEM_USER: User = Object.assign(new User(), {
  username: 'system',
  roles: ['admin', 'system'],
})

/**
 * Creates a child injector with an elevated IdentityContext
 * that impersonates a system user with full privileges.
 * Use for background services, middleware, and startup operations
 * that need data access without an HTTP request context.
 */
export const createElevatedContext = (injector: Injector): Injector => {
  const child = injector.createChild({ owner: 'elevated-context' })
  child.setExplicitInstance<IdentityContext>(
    {
      isAuthenticated: async () => true,
      isAuthorized: async () => true,
      getCurrentUser: async <TUser>() => SYSTEM_USER as TUser,
    },
    IdentityContext,
  )
  return child
}
