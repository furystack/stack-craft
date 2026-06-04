import type { Page } from '@playwright/test'

export type StackSidebarLink = 'Services' | 'Repositories' | 'Prerequisites'

export const navigateViaSidebar = async (page: Page, stackDisplayName: string, link: StackSidebarLink) => {
  const stackSidebar = page.locator('shade-accordion-item').filter({ hasText: stackDisplayName })

  const isExpanded = await stackSidebar.getAttribute('data-expanded')
  if (isExpanded === null) {
    await stackSidebar.locator('.accordion-header').click()
  }

  await stackSidebar.locator('shade-sidebar-stack-link a', { hasText: link }).click()
}
