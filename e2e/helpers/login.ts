import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const login = async (page: Page, userName = 'testuser', password = 'password') => {
  const loginForm = page.locator('shade-login form')
  await expect(loginForm).toBeVisible({ timeout: 15000 })

  await loginForm.locator('input[name="userName"]').fill(userName)
  await loginForm.locator('input[name="password"]').fill(password)
  await page.locator('button', { hasText: 'Sign in' }).click()

  await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10000 })
}
