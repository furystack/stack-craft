import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { expectNotification } from './notification.js'

export type PrerequisiteParams = {
  name: string
  type: 'Node.js' | 'Yarn' | 'Git' | 'Environment Variable'
  minimumVersion?: string
  variableName?: string
  isSensitive?: boolean
}

export const addPrerequisite = async (page: Page, params: PrerequisiteParams) => {
  const prereqForm = page.locator('shade-prerequisite-form')
  const typeSelect = page.locator('shade-select').filter({ has: page.locator('input[name="type"]') })

  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill(params.name)
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: params.type }).first().click()

  if (params.minimumVersion) {
    await prereqForm.locator('input[name="minimumVersion"]').fill(params.minimumVersion)
  }
  if (params.variableName) {
    await prereqForm.locator('input[name="variableName"]').fill(params.variableName)
  }
  if (params.isSensitive) {
    await prereqForm.locator('input[name="isSensitive"]').check()
  }

  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expectNotification(page, `"${params.name}" was added.`)
}
