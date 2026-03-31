import type { Page } from '@playwright/test'

export const navigateViaSidebar = async (
  page: Page,
  stackDisplayName: string,
  link: 'Overview' | 'Services' | 'Repositories' | 'Prerequisites',
) => {
  const stackSidebar = page.locator('shade-accordion-item').filter({ hasText: stackDisplayName })

  // Expand the accordion if it's collapsed
  const isExpanded = await stackSidebar.getAttribute('data-expanded')
  if (isExpanded === null) {
    await stackSidebar.locator('.accordion-header').click()
  }

  await stackSidebar.locator('shade-sidebar-stack-link a', { hasText: link }).click()
}
