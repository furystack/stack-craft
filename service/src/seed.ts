import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { PasswordAuthenticator, PasswordCredential } from '@furystack/security'
import { User } from 'common'

import { injector } from './config.js'
import { createElevatedContext } from './utils/elevated-context.js'

/**
 * Seeds the databases with predefined values
 * @param i The injector instance
 */
export const seed = async (i: Injector): Promise<void> => {
  const logger = getLogger(i).withScope('seeder')
  await logger.verbose({ message: 'Seeding data...' })

  const elevated = createElevatedContext(i)
  try {
    const repository = getRepository(elevated)
    const userDs = repository.getDataSetFor(User, 'username')
    const pwcDs = repository.getDataSetFor(PasswordCredential, 'userName')

    const existingUsers = await userDs.find(elevated, { filter: { username: { $eq: 'testuser' } } })
    if (existingUsers.length === 0) {
      const cred = await i.getInstance(PasswordAuthenticator).hasher.createCredential('testuser', 'password')
      await logger.verbose({ message: 'Saving credential...' })
      await pwcDs.add(elevated, cred)
      await logger.verbose({ message: 'Saving User...' })
      await userDs.add(elevated, { username: 'testuser', roles: [] })
    } else {
      await logger.verbose({ message: 'Test user already exists, skipping seed.' })
    }

    await logger.verbose({ message: 'Seeding data completed.' })
  } finally {
    await elevated[Symbol.asyncDispose]()
  }
}

await seed(injector)
await injector[Symbol.asyncDispose]()
