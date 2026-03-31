import { expect, test } from '@playwright/test'

import {
  addRepository,
  createStack,
  deleteStack,
  fillServiceForm,
  login,
  navigateToCreateService,
  submitServiceForm,
} from './helpers/index.js'

test('App Flow', async ({ page, browserName }) => {
  const uuid = crypto.randomUUID()

  const stackName = `e2e-test-stack-${uuid}`
  const displayName = `E2E Test Stack - ${browserName} - ${uuid}`
  const workingDirectory = `/tmp/e2e-test-stack-${uuid}`

  await page.goto('/')
  await login(page)

  try {
    await test.step('Create stack', async () => {
      await createStack(page, {
        name: stackName,
        displayName,
        description: 'Created by E2E test',
        mainDirectory: '/tmp/e2e-test',
      })
    })

    await test.step('Create first service', async () => {
      await navigateToCreateService(page, displayName)
      await fillServiceForm(page, { displayName: 'E2E Service', workingDirectory, runCommand: 'echo hello' })
      await submitServiceForm(page)
      await expect(page.locator('shade-services-list')).toBeVisible()
    })

    await test.step('Add repository', async () => {
      await addRepository(page, displayName, {
        displayName: 'FuryStack',
        url: 'https://github.com/furystack/furystack',
      })
    })

    await test.step('Create second service', async () => {
      await navigateToCreateService(page, displayName)
      await fillServiceForm(page, {
        displayName: 'StackCraft DOG FOODING TIME!',
        workingDirectory,
        runCommand: 'echo hello',
      })
      await submitServiceForm(page)
      await expect(page.locator('shade-services-list')).toBeVisible()
    })
  } finally {
    await test.step('Clean up stack', async () => {
      await deleteStack(page, displayName)
    })
  }
})
