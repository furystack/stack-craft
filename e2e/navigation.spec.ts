import { tmpdir } from 'os'
import { join } from 'path'

import { expect, test } from '@playwright/test'

import { createStack, deleteStack, login, openStackActionsMenu } from './helpers/index.js'

test('Navigation restructure', async ({ page, browserName }) => {
  const uuid = crypto.randomUUID()
  const stackName = `e2e-nav-${uuid}`
  const displayName = `Nav Stack - ${browserName} - ${uuid}`

  await page.goto('/')
  await login(page)

  try {
    await test.step('Create stack lands on Services', async () => {
      await createStack(page, {
        name: stackName,
        displayName,
        description: 'Navigation restructure E2E',
        mainDirectory: join(tmpdir(), `e2e-nav-${uuid}`),
      })
      await expect(page).toHaveURL(new RegExp(`/stacks/${stackName}/services$`))
    })

    await test.step('Legacy routes redirect to Services', async () => {
      await page.goto(`/stacks/${stackName}`)
      await expect(page.locator('shade-services-list')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/stacks/${stackName}/services$`))

      await page.goto(`/stacks/${stackName}/setup`)
      await expect(page.locator('shade-services-list')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/stacks/${stackName}/services$`))
    })

    await test.step('Stack actions menu reaches Edit and Export', async () => {
      await openStackActionsMenu(page)
      await page.getByRole('menuitem', { name: 'Edit Stack' }).click()
      await expect(page.locator('shade-edit-stack')).toBeVisible()

      await page.goto(`/stacks/${stackName}/services`)
      await openStackActionsMenu(page)
      await page.getByRole('menuitem', { name: 'Export Stack' }).click()
      await expect(page.locator('shade-export-stack')).toBeVisible()
    })

    await test.step('Stack actions menu runs Set Up All', async () => {
      await page.goto(`/stacks/${stackName}/services`)
      await openStackActionsMenu(page)
      await page.getByRole('menuitem', { name: 'Set Up All' }).click()
      await expect(page.locator('shade-services-list')).toBeVisible()
    })

    await test.step('Dashboard card actions do not navigate away', async () => {
      await page.locator('shade-sidebar-item a', { hasText: 'Dashboard' }).click()
      await expect(page.locator('stack-list-dashboard')).toBeVisible()

      const card = page.locator('stack-card', { hasText: displayName })
      await card.getByRole('button', { name: 'Start All' }).click()
      await expect(page.locator('stack-list-dashboard')).toBeVisible()
      await expect(page).toHaveURL('/')
    })

    await test.step('Sidebar shows stack status dot', async () => {
      await expect(page.locator('shade-sidebar-stack-item [data-testid="stack-status-dot"]').first()).toBeVisible()
    })
  } finally {
    await test.step('Clean up stack', async () => {
      await deleteStack(page, displayName)
    })
  }
})
