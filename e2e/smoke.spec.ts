import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

test.describe.serial('App Flow', () => {
  let stackName: string
  let displayName: string

  test('Login and view dashboard', async ({ page }) => {
    await page.goto('/')
    await login(page)
  })

  test('Create stack, create service, verify dashboard', async ({ page, browserName }) => {
    const uuid = crypto.randomUUID()

    stackName = `e2e-test-stack-${uuid}`
    displayName = `E2E Test Stack - ${browserName} - ${uuid}`

    const workingDirectory = `/tmp/e2e-test-stack-${uuid}`

    await page.goto('/')
    await login(page)

    // Create stack
    await page.locator('button, a', { hasText: 'Create Stack' }).first().click()
    await expect(page.locator('shade-create-stack')).toBeVisible()

    await page.locator('input[name="name"]').fill(stackName)
    await page.locator('input[name="displayName"]').fill(displayName)
    await page.locator('textarea[name="description"]').fill('Created by E2E test')
    await page.locator('input[name="mainDirectory"]').fill('/tmp/e2e-test')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-noty-list')).toContainText(`Stack "${displayName}" was created successfully.`)

    await expect(page.locator('shade-dashboard')).toBeVisible()

    await expect(page.getByTestId('page-header-title')).toContainText(displayName)

    // Navigate to services list via the dashboard card's "View All" link
    await page.locator('shade-dashboard a', { hasText: 'View All' }).first().click()
    await expect(page.locator('shade-services-list')).toBeVisible()
    await page.locator('button', { hasText: 'Create Service' }).first().click()
    await expect(page.locator('shade-create-service-wizard')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('E2E Service')
    await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
    await page.locator('input[name="runCommand"]').fill('echo hello')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-services-list')).toBeVisible()

    // Scope all sidebar interactions to the correct stack
    const stackSidebar = page.locator('shade-accordion-item').filter({ hasText: displayName })

    // Navigate to repositories list
    await stackSidebar.locator('shade-sidebar-stack-link a', { hasText: 'Repositories' }).click()
    await expect(page.locator('shade-repositories-list')).toBeVisible()
    await page.locator('button', { hasText: 'Add Repository' }).first().click()
    await expect(page.locator('shade-create-repository')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('FuryStack')
    await page.locator('input[name="url"]').fill('https://github.com/furystack/furystack')
    await page.locator('button', { hasText: 'Add' }).click()

    await expect(page.locator('shade-repositories-list')).toBeVisible()

    // Navigate to services list
    await stackSidebar.locator('shade-sidebar-stack-link a', { hasText: 'Services' }).click()
    await expect(page.locator('shade-services-list')).toBeVisible()
    await page.locator('button', { hasText: 'Create Service' }).first().click()
    await expect(page.locator('shade-create-service-wizard')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('StackCraft DOG FOODING TIME!')
    await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
    await page.locator('input[name="runCommand"]').fill('echo hello')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-services-list')).toBeVisible()
  })

  test('Clean up stack', async ({ page }) => {
    await page.goto('/')
    await login(page)

    // Click on the stack card in the main dashboard to open its overview
    await page.locator('stack-list-dashboard shade-card', { hasText: displayName }).click()
    await expect(page.getByTestId('page-header-title')).toContainText(displayName)

    // Navigate to Edit Stack via the header button
    await page.locator('a', { hasText: 'Edit Stack' }).click()
    await expect(page.locator('shade-edit-stack')).toBeVisible()

    // Delete the stack
    await page.locator('button', { hasText: 'Delete Stack' }).click()
    await page.locator('shade-dialog .dialog-confirm-btn').click()

    await expect(page.locator('shade-noty-list')).toContainText(`"${displayName}" was deleted.`)
    await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10000 })
  })
})
