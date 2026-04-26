import { getCurrentUser, isAuthenticated, isAuthorized } from '@furystack/core'
import { IdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { usingAsync } from '@furystack/utils'
import { User } from 'common'
import { describe, expect, it } from 'vitest'

import { UserIdentityContext, useUserIdentityContext } from './user-identity-context.js'

describe('UserIdentityContext', () => {
  const makeUser = (roles: string[] = []): User => {
    const u = new User()
    u.username = 'alice'
    u.roles = roles
    return u
  }

  it('should report authenticated', async () => {
    const ctx = new UserIdentityContext(makeUser())
    expect(await ctx.isAuthenticated()).toBe(true)
  })

  it('should authorize when user has all required roles', async () => {
    const ctx = new UserIdentityContext(makeUser(['admin', 'editor']))
    expect(await ctx.isAuthorized('admin', 'editor')).toBe(true)
  })

  it('should authorize when no roles are required', async () => {
    const ctx = new UserIdentityContext(makeUser())
    expect(await ctx.isAuthorized()).toBe(true)
  })

  it('should deny when user lacks a required role', async () => {
    const ctx = new UserIdentityContext(makeUser(['viewer']))
    expect(await ctx.isAuthorized('admin')).toBe(false)
  })

  it('should deny when user has some but not all required roles', async () => {
    const ctx = new UserIdentityContext(makeUser(['admin']))
    expect(await ctx.isAuthorized('admin', 'superuser')).toBe(false)
  })

  it('should return the user via getCurrentUser', async () => {
    const user = makeUser(['admin'])
    const ctx = new UserIdentityContext(user)
    const result = await ctx.getCurrentUser()
    expect(result).toBe(user)
  })
})

describe('useUserIdentityContext', () => {
  it('should return a child injector, not the parent', async () => {
    await usingAsync(new Injector(), async (parent) => {
      const child = useUserIdentityContext({
        injector: parent,
        user: Object.assign(new User(), { username: 'bob', roles: [] }),
      })
      expect(child).not.toBe(parent)
      await child[Symbol.asyncDispose]()
    })
  })

  it('should resolve IdentityContext to a UserIdentityContext', async () => {
    await usingAsync(new Injector(), async (parent) => {
      const user = Object.assign(new User(), { username: 'carol', roles: ['admin'] })
      await usingAsync(useUserIdentityContext({ injector: parent, user }), async (child) => {
        const ctx = child.get(IdentityContext)
        expect(ctx).toBeInstanceOf(UserIdentityContext)
      })
    })
  })

  it('should be authenticated and authorized via core helpers', async () => {
    await usingAsync(new Injector(), async (parent) => {
      const user = Object.assign(new User(), { username: 'dave', roles: ['admin'] })
      await usingAsync(useUserIdentityContext({ injector: parent, user }), async (child) => {
        expect(await isAuthenticated(child)).toBe(true)
        expect(await isAuthorized(child, 'admin')).toBe(true)
        expect(await isAuthorized(child, 'superuser')).toBe(false)
      })
    })
  })

  it('should return the user via getCurrentUser helper', async () => {
    await usingAsync(new Injector(), async (parent) => {
      const user = Object.assign(new User(), { username: 'eve', roles: [] })
      await usingAsync(useUserIdentityContext({ injector: parent, user }), async (child) => {
        const resolved = await getCurrentUser(child)
        expect(resolved.username).toBe('eve')
      })
    })
  })

  it('should dispose the child injector after usingAsync completes', async () => {
    await usingAsync(new Injector(), async (parent) => {
      let childRef: Injector | undefined
      await usingAsync(
        useUserIdentityContext({ injector: parent, user: Object.assign(new User(), { username: 'f', roles: [] }) }),
        async (child) => {
          childRef = child
        },
      )
      expect(childRef).toBeDefined()
      expect(() => childRef!.get(IdentityContext)).toThrow('Injector already disposed')
    })
  })
})
