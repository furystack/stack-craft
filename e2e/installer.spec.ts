import { expect, test } from '@playwright/test'

test.describe.serial('Installer Wizard', () => {
  test('should complete the installer wizard', async ({ page }) => {
    await page.goto('/')

    const welcomeStep = page.locator('shade-welcome-step')
    await expect(welcomeStep).toBeVisible()

    const welcomeStepNextButton = welcomeStep.locator('button', { hasText: 'Next' })

    await expect(page.locator('text=Welcome to StackCraft')).toBeVisible()
    await welcomeStepNextButton.click()

    const prerequisitesStep = page.locator('shade-check-prerequisites-step')
    await expect(page.locator('text=Prerequisites')).toBeVisible()
    const prerequisitesStepNextButton = prerequisitesStep.locator('button', { hasText: 'Next' })
    await prerequisitesStepNextButton.click()

    const adminStep = page.locator('shade-create-admin-step')

    await expect(page.locator('text=Create Admin User')).toBeVisible()
    await page.locator('input[name="username"]').fill('testuser')
    await page.locator('input[name="password"]').fill('password')

    const adminStepNextButton = adminStep.locator('button', { hasText: 'Next' })
    await adminStepNextButton.click()

    await expect(page.locator('text=Success')).toBeVisible()
    await page.locator('button', { hasText: 'Finish' }).click()
  })

  test('should show login page after install', async ({ page }) => {
    await page.goto('/')

    const loginForm = page.locator('shade-login form')
    await expect(loginForm).toBeVisible()
  })
})
