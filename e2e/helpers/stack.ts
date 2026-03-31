import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { expectNotification } from './notification.js'

export type CreateStackParams = {
  name: string
  displayName: string
  description: string
  mainDirectory: string
}

export const createStack = async (page: Page, params: CreateStackParams) => {
  await page.locator('button, a', { hasText: 'Create Stack' }).first().click()
  await expect(page.locator('shade-create-stack')).toBeVisible()

  await page.locator('input[name="name"]').fill(params.name)
  await page.locator('input[name="displayName"]').fill(params.displayName)
  await page.locator('textarea[name="description"]').fill(params.description)
  await page.locator('input[name="mainDirectory"]').fill(params.mainDirectory)
  await page.locator('button', { hasText: 'Create' }).click()

  await expectNotification(page, `Stack "${params.displayName}" was created successfully.`)
  await expect(page.locator('shade-dashboard')).toBeVisible()
  await expect(page.getByTestId('page-header-title')).toContainText(params.displayName)
}

export const deleteStack = async (page: Page, displayName: string) => {
  // Navigate to the main dashboard via the sidebar "Dashboard" link (always visible, no accordion)
  await page.locator('shade-sidebar-item a', { hasText: 'Dashboard' }).click()
  await expect(page.locator('stack-list-dashboard')).toBeVisible()

  // Click on the stack card to open its overview
  await page.locator('stack-list-dashboard shade-card', { hasText: displayName }).click()
  await expect(page.getByTestId('page-header-title')).toContainText(displayName)

  // Navigate to Edit Stack, then delete
  await page.locator('a', { hasText: 'Edit Stack' }).click()
  await expect(page.locator('shade-edit-stack')).toBeVisible()

  await page.locator('button', { hasText: 'Delete Stack' }).click()
  await page.locator('shade-dialog .dialog-confirm-btn').click()

  await expectNotification(page, `"${displayName}" was deleted.`)
  await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10_000 })
}
