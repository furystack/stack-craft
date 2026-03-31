import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const expectNotification = async (page: Page, text: string) => {
  await expect(page.locator('shade-noty-list')).toContainText(text)
}
