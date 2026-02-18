import { expect, test } from '@playwright/test'

test.describe('StackCraft MVP Flow', () => {
  test('should complete the installer wizard', async ({ page }) => {
    await page.goto('/')

    const installerOrLogin = page.locator('shade-lazy-installer, shade-login')
    await expect(installerOrLogin.first()).toBeVisible({ timeout: 15000 })

    const isInstaller = (await page.locator('shade-lazy-installer').count()) > 0
    if (!isInstaller) {
      return
    }

    const nextButton = page.locator('button', { hasText: 'Next' })

    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 })
    await nextButton.click()

    await expect(page.locator('text=Prerequisites')).toBeVisible({ timeout: 5000 })
    await nextButton.click()

    await expect(page.locator('text=Admin')).toBeVisible({ timeout: 5000 })
    const usernameInput = page.locator('input[name="userName"]')
    const passwordInput = page.locator('input[name="password"]')
    await usernameInput.fill('testuser')
    await passwordInput.fill('password')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('text=Success')).toBeVisible({ timeout: 10000 })
    await page.locator('button', { hasText: 'Finish' }).click()
  })

  test('Login and view dashboard', async ({ page }) => {
    await page.goto('/')

    const loginForm = page.locator('shade-login form')
    await expect(loginForm).toBeVisible({ timeout: 15000 })

    await loginForm.locator('input[name="userName"]').fill('testuser')
    await loginForm.locator('input[name="password"]').fill('password')
    await page.locator('button', { hasText: 'Login' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10000 })
  })

  test('Create stack, create service, verify dashboard', async ({ page }) => {
    await page.goto('/')

    const loginForm = page.locator('shade-login form')
    await expect(loginForm).toBeVisible({ timeout: 15000 })
    await loginForm.locator('input[name="userName"]').fill('testuser')
    await loginForm.locator('input[name="password"]').fill('password')
    await page.locator('button', { hasText: 'Login' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10000 })

    await page.locator('button', { hasText: 'Create Stack' }).first().click()
    await expect(page.locator('shade-create-stack')).toBeVisible({ timeout: 5000 })

    await page.locator('input[name="name"]').fill('e2e-test-stack')
    await page.locator('input[name="displayName"]').fill('E2E Test Stack')
    await page.locator('input[name="description"]').fill('Created by E2E test')
    await page.locator('input[name="mainDirectory"]').fill('/tmp/e2e-test')
    await page.locator('button', { hasText: 'Create' }).click()

    await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=E2E Test Stack')).toBeVisible({ timeout: 5000 })

    await page.locator('button', { hasText: 'Create Service' }).first().click()
    await expect(page.locator('shade-create-service')).toBeVisible({ timeout: 5000 })

    await page.locator('input[name="displayName"]').fill('E2E Service')
    await page.locator('input[name="workingDirectory"]').fill('/tmp/e2e-test/svc')
    await page.locator('input[name="runCommand"]').fill('echo hello')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=E2E Service')).toBeVisible({ timeout: 5000 })
  })
})
