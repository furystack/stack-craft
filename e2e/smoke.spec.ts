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

    await page.locator('button, a', { hasText: 'Create Stack' }).first().click()
    await expect(page.locator('shade-create-stack')).toBeVisible()

    await page.locator('input[name="name"]').fill(stackName)
    await page.locator('input[name="displayName"]').fill(displayName)
    await page.locator('textarea[name="description"]').fill('Created by E2E test')
    await page.locator('input[name="mainDirectory"]').fill('/tmp/e2e-test')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible()

    await expect(page.getByRole('heading').locator(`text=${displayName}`)).toBeVisible()

    await page.locator('button', { hasText: 'Create Service' }).first().click()
    await expect(page.locator('shade-create-service')).toBeVisible()

    await page.locator('input[name="displayName"]').fill('E2E Service')
    await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
    await page.locator('input[name="runCommand"]').fill('echo hello')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('shade-dashboard')).toBeVisible()
    await expect(page.locator(`text=${displayName}`)).toBeVisible()
  })
})
