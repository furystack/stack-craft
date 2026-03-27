import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

test.describe.serial('App Flow', () => {
  test('Login and view dashboard', async ({ page }) => {
    await page.goto('/')
    await login(page)
  })

  test('Create stack, create service, verify dashboard', async ({ page, browserName }) => {
    const uuid = crypto.randomUUID()

    const stackName = `e2e-test-stack-${uuid}`
    const displayName = `E2E Test Stack - ${browserName} - ${uuid}`

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

    // Create an example "Hello World" service
    await page.locator('button', { hasText: 'Create Service' }).first().click()
    await expect(page.locator('shade-create-service-wizard')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('E2E Service')
    await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
    await page.locator('input[name="runCommand"]').fill('echo hello')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible()
    await expect(page.getByTestId('page-header-title')).toContainText(displayName)

    // Create a repository - FuryStack (https://github.com/furystack/furystack)
    await page.locator('button', { hasText: 'Add Repository' }).first().click()
    await expect(page.locator('shade-create-repository')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('FuryStack')
    await page.locator('input[name="url"]').fill('https://github.com/furystack/furystack')
    await page.locator('button', { hasText: 'Add' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible()
    await expect(page.getByTestId('page-header-title')).toContainText(displayName)

    await page.locator('button', { hasText: 'Create Service' }).first().click()
    await expect(page.locator('shade-create-service-wizard')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('StackCraft DOG FOODING TIME!')
    await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
    await page.locator('input[name="runCommand"]').fill('echo hello')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible()
  })
})
