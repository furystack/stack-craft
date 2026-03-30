import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { navigateViaSidebar } from './sidebar.js'

export type AddRepositoryParams = {
  displayName: string
  url: string
}

export const addRepository = async (page: Page, stackDisplayName: string, params: AddRepositoryParams) => {
  await navigateViaSidebar(page, stackDisplayName, 'Repositories')
  await expect(page.locator('shade-repositories-list')).toBeVisible()

  await page.locator('button', { hasText: 'Add Repository' }).first().click()
  await expect(page.locator('shade-create-repository')).toBeVisible()

  await page.locator('input[name="displayName"]').fill(params.displayName)
  await page.locator('input[name="url"]').fill(params.url)
  await page.locator('button', { hasText: 'Add' }).click()

  await expect(page.locator('shade-repositories-list')).toBeVisible()
}
