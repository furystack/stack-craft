import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { navigateViaSidebar } from './sidebar.js'

export type CreateServiceParams = {
  displayName: string
  workingDirectory: string
  runCommand: string
  installCommand?: string
  buildCommand?: string
}

export const navigateToCreateService = async (page: Page, stackDisplayName: string) => {
  await navigateViaSidebar(page, stackDisplayName, 'Services')
  await expect(page.locator('shade-services-list')).toBeVisible()
  await page.locator('button', { hasText: 'Create Service' }).first().click()
  await expect(page.locator('shade-create-service-wizard')).toBeVisible()
}

export const fillServiceForm = async (page: Page, params: CreateServiceParams) => {
  await page.locator('input[name="displayName"]').fill(params.displayName)
  await page.locator('input[name="workingDirectory"]').fill(params.workingDirectory)
  await page.locator('input[name="runCommand"]').fill(params.runCommand)
  if (params.installCommand) {
    await page.locator('input[name="installCommand"]').fill(params.installCommand)
  }
  if (params.buildCommand) {
    await page.locator('input[name="buildCommand"]').fill(params.buildCommand)
  }
}

export const submitServiceForm = async (page: Page) => {
  await page.locator('button', { hasText: 'Create' }).click()
}
