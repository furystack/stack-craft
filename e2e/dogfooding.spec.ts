import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

test('DOG FOODING TIME - Create a service that uses the StackCraft GitHub repository. Clone, install, build and run the service', async ({
  page,
  browserName,
}) => {
  const uuid = crypto.randomUUID()

  const stackName = `e2e-dog-fooding-time-${uuid}`
  const displayName = `E2E DOG FOODING TIMETest Stack - ${browserName} - ${uuid}`

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

  // Add StackCraft GitHub repository inline
  await page.locator('button', { hasText: 'New' }).click()
  const repoForm = page.locator('shade-github-repo-form')
  await expect(repoForm).toBeVisible()
  await repoForm.locator('input[name="url"]').fill('https://github.com/furystack/stack-craft')
  await repoForm.locator('input[name="displayName"]').fill('StackCraft')
  await repoForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"StackCraft" was added.')

  // Select the newly created repository
  const repoSelect = page.locator('shade-select').filter({ has: page.locator('input[name="repositoryId"]') })
  await repoSelect.locator('.select-trigger').click()
  await repoSelect.locator('.dropdown-item', { hasText: 'StackCraft' }).click()

  await page.locator('input[name="installCommand"]').fill('yarn install')
  await page.locator('input[name="buildCommand"]').fill('yarn build')
  await page.locator('input[name="runCommand"]').fill('yarn start:service')

  await page.locator('button', { hasText: 'Create' }).click()

  // Step 2: Set up the service (clone, install, build)
  await page.locator('button', { hasText: 'Set up now' }).click()

  // Clone + install + build may take several minutes
  await expect(page.getByText('Service set up successfully!')).toBeVisible({ timeout: 10 * 60 * 1000 })

  // Navigate to the service detail
  await page.locator('button', { hasText: 'View Service' }).click()
  await expect(page.locator('shade-service-detail')).toBeVisible()

  // Start the service
  await page.locator('shade-service-detail button', { hasText: 'Start' }).click()

  // Wait for the service to reach running state
  await expect(page.locator('shade-service-status-indicator')).toContainText('Running')

  // Navigate to logs
  await page.getByTestId('page-header-actions').getByRole('button', { name: 'Logs' }).click()
  await expect(page.locator('shade-service-logs')).toBeVisible()

  // Verify that log entries appear
  await expect(page.locator('shade-log-viewer')).toBeVisible()
  await expect(page.locator('shade-log-viewer')).not.toContainText('No log output yet.')
})
