import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

test('DOG FOODING TIME - Create a service that uses the StackCraft GitHub repository. Clone, install, build and run the service', async ({
  page,
  browserName,
}) => {
  const uuid = crypto.randomUUID()

  const stackName = `e2e-dog-fooding-time-${uuid}`
  const displayName = `E2E Test Stack - ${browserName} - ${uuid}`

  const workingDirectory = `/tmp/e2e-dog-fooding-time-${uuid}`

  await page.goto('/')
  await login(page)

  // Create stack
  await page.locator('button', { hasText: 'Create Stack' }).first().click()
  await expect(page.locator('shade-create-stack')).toBeVisible()

  await page.locator('input[name="name"]').fill(stackName)
  await page.locator('input[name="displayName"]').fill(displayName)
  await page.locator('textarea[name="description"]').fill('Created by E2E test')
  await page.locator('input[name="mainDirectory"]').fill('/tmp/e2e-test')
  await page.locator('button', { hasText: 'Create' }).click()

  await expect(page.locator('shade-noty-list')).toContainText(`Stack "${displayName}" was created successfully.`)

  await expect(page.locator('shade-dashboard')).toBeVisible()

  await expect(page.getByTestId('page-header-title')).toContainText(displayName)

  // Create the service with the StackCraft GitHub repository
  await page.locator('button', { hasText: 'Create Service' }).first().click()
  await expect(page.locator('shade-create-service-wizard')).toBeVisible()

  await page.locator('input[name="displayName"]').fill('StackCraft DOG FOODING TIME!')
  await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
  await page.locator('input[name="runCommand"]').fill('yarn start:service')

  await page.locator('input[name="installCommand"]').fill('yarn install')
  await page.locator('input[name="buildCommand"]').fill('yarn build')
  await page.locator('input[name="runCommand"]').fill('yarn start:service')

  await page.locator('button', { hasText: 'Create' }).click()

  await page.locator('button', { hasText: 'Set up now' }).click()

  await expect(page.locator('shade-dashboard')).toBeVisible()
  await expect(page.locator(`text=${displayName}`)).toBeVisible()

  // Verify the service is running
  await expect(page.locator('shade-service-logs')).toBeVisible()
})
