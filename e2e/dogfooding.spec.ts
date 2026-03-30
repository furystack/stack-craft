import { expect, test } from '@playwright/test'

import {
  addPrerequisite,
  createStack,
  deleteStack,
  expectNotification,
  fillServiceForm,
  login,
  navigateToCreateService,
  submitServiceForm,
} from './helpers/index.js'

test('DOG FOODING TIME - Create a service that uses the StackCraft GitHub repository. Clone, install, build and run the service', async ({
  page,
  browserName,
}) => {
  const uuid = crypto.randomUUID()

  const stackName = `e2e-dog-fooding-time-${uuid}`
  const displayName = `Dog Fooding - ${browserName} - ${uuid}`
  const description = `
##### 🐶🦴 E2E - IT'S DOG FOODING TIME 🐶🦴

This stack is used to test the dogfooding of the StackCraft application.
It is used to test the following features:
  - Creating a stack
  - Adding realistic prerequisites (Node.js, Yarn, Git, environment variables)
  - Configuring environment variables (plain text + confidential)
  - Adding a local .env file override
  - Creating a service that uses the StackCraft GitHub repository
  - Cloning, installing, building and running the service

##### Test Steps

  1. Create a stack
  2. Create a service with prerequisites, env vars, file overrides, and the StackCraft GitHub repository
  3. Clone, install, build and run the service
  4. Verify that the first start fails (port already in use)
  5. Override APP_SERVICE_PORT to a unique port and restart
  6. Verify that the service is running and reachable via HTTP
  7. Stop the service and remove the stack

  `

  const dogfoodingPort = browserName === 'chromium' ? 19090 : 19091
  const workingDirectory = `/tmp/e2e-dog-fooding-time-${uuid}`

  await page.goto('/')
  await login(page)

  try {
    await test.step('Create stack', async () => {
      await createStack(page, {
        name: stackName,
        displayName,
        description,
        mainDirectory: '/tmp/e2e-test',
      })
    })

    await test.step('Configure and create service', async () => {
      await navigateToCreateService(page, displayName)

      await fillServiceForm(page, {
        displayName: 'StackCraft DOG FOODING TIME!',
        workingDirectory,
        runCommand: 'yarn start:service',
      })

      // --- Add realistic prerequisites ---
      await addPrerequisite(page, { name: 'Node.js >= 22', type: 'Node.js', minimumVersion: '22.0.0' })
      await addPrerequisite(page, { name: 'Yarn >= 4', type: 'Yarn', minimumVersion: '4.0.0' })
      await addPrerequisite(page, { name: 'Git', type: 'Git' })
      await addPrerequisite(page, { name: 'Mock API Key', type: 'Environment Variable', variableName: 'MOCK_API_KEY' })
      await addPrerequisite(page, {
        name: 'Encryption Key',
        type: 'Environment Variable',
        variableName: 'STACK_CRAFT_ENCRYPTION_KEY',
        isSensitive: true,
      })
      await addPrerequisite(page, { name: 'Database URL', type: 'Environment Variable', variableName: 'DATABASE_URL' })
      await addPrerequisite(page, {
        name: 'Service Port',
        type: 'Environment Variable',
        variableName: 'APP_SERVICE_PORT',
      })
      await addPrerequisite(page, { name: 'MCP Port', type: 'Environment Variable', variableName: 'MCP_PORT' })

      // --- Add local .env file override ---
      await page.locator('button', { hasText: 'Add Local File' }).click()
      await page.locator('input[placeholder="Relative path (e.g. .env)"]').fill('.env')
      await page
        .locator('textarea[placeholder="File content"]')
        .fill('STACK_CRAFT_ENCRYPTION_KEY=e2e-dogfooding-test-key')

      // --- Add StackCraft GitHub repository inline ---
      await page.locator('button', { hasText: 'New' }).click()
      const repoForm = page.locator('shade-github-repo-form')
      await expect(repoForm).toBeVisible()
      await repoForm.locator('input[name="url"]').fill('https://github.com/furystack/stack-craft')
      await repoForm.locator('input[name="displayName"]').fill('StackCraft')
      await repoForm.locator('button', { hasText: 'Add' }).click()
      await expectNotification(page, '"StackCraft" was added.')

      // Select the newly created repository
      const repoSelect = page.locator('shade-select').filter({ has: page.locator('input[name="repositoryId"]') })
      await repoSelect.locator('.select-trigger').click()
      await repoSelect.locator('.dropdown-item', { hasText: 'StackCraft' }).click()

      await page.locator('input[name="installCommand"]').fill('yarn install')
      await page.locator('input[name="buildCommand"]').fill('yarn build')
      await page.locator('input[name="runCommand"]').fill('yarn start:service')

      await submitServiceForm(page)
    })

    await test.step('Set up service (clone, install, build)', async () => {
      await page.locator('button', { hasText: 'Set up now' }).click()

      // Clone + install + build may take several minutes
      await expect(page.getByText('Service set up successfully!')).toBeVisible({ timeout: 10 * 60 * 1000 })

      await page.locator('button', { hasText: 'View Service' }).click()
      await expect(page.locator('shade-service-detail')).toBeVisible()
    })

    await test.step('First start attempt — expect failure (port already in use)', async () => {
      await page.getByTestId('page-header-actions').getByRole('button', { name: 'Start' }).click()

      // The spawned service will try to bind to port 9090 (default), which is
      // already occupied by the test host. Expect status to transition to Error.
      await expect(page.getByTestId('service-status-indicator')).toContainText('Error', { timeout: 60_000 })

      await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Logs' }).click()
      await expect(page.locator('shade-service-logs-tab')).toBeVisible()

      const logViewer = page.locator('shade-service-logs-tab shade-log-viewer')
      await expect(logViewer).toBeVisible()
      await expect(logViewer).toContainText(/EADDRINUSE|address already in use/, { timeout: 10_000 })
    })

    await test.step('Override APP_SERVICE_PORT and MCP_PORT, then restart', async () => {
      await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Configuration' }).click()
      await expect(page.locator('shade-service-config-tab')).toBeVisible()

      // Set APP_SERVICE_PORT override to a unique port per browser
      const portOverride = page.getByTestId('env-override-APP_SERVICE_PORT')
      await expect(portOverride).toBeVisible()

      const portSourceSelect = portOverride.locator('shade-select').first()
      await portSourceSelect.locator('.select-trigger').click()
      await portSourceSelect.locator('.dropdown-item', { hasText: 'Custom value' }).click()
      await portOverride.locator('shade-input input').fill(String(dogfoodingPort))

      // Set MCP_PORT override to avoid conflict with the test host's MCP server
      const mcpOverride = page.getByTestId('env-override-MCP_PORT')
      await expect(mcpOverride).toBeVisible()

      const mcpSourceSelect = mcpOverride.locator('shade-select').first()
      await mcpSourceSelect.locator('.select-trigger').click()
      await mcpSourceSelect.locator('.dropdown-item', { hasText: 'Custom value' }).click()
      await mcpOverride.locator('shade-input input').fill(String(dogfoodingPort + 1))

      // Save the overrides and wait for the save to complete
      const saveButton = page.getByTestId('save-env-overrides')
      await saveButton.click()
      await expect(saveButton).not.toHaveAttribute('loading', { timeout: 10_000 })

      // Navigate back to the Overview tab and start the service again
      await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Overview' }).click()
      await page.getByTestId('page-header-actions').getByRole('button', { name: 'Start' }).click()

      await expect(page.getByTestId('service-status-indicator')).toContainText('Running', { timeout: 60_000 })
    })

    await test.step('Verify logs and HTTP reachability', async () => {
      await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Logs' }).click()
      await expect(page.locator('shade-service-logs-tab')).toBeVisible()

      const successLogViewer = page.locator('shade-service-logs-tab shade-log-viewer')
      await expect(successLogViewer).toBeVisible()
      await expect(successLogViewer).not.toContainText('No log output yet.')

      await expect(async () => {
        const response = await page.request.get(`http://localhost:${dogfoodingPort}`)
        expect(response.status()).toBe(200)
      }).toPass({ timeout: 30_000 })
    })

    await test.step('Stop the service', async () => {
      // SIGTERM may cause non-zero exit → "Error" or clean → "Stopped"
      await page.getByTestId('page-header-actions').getByRole('button', { name: 'Stop' }).click()
      await expect(page.getByTestId('service-status-indicator')).toContainText(/Stopped|Error/, { timeout: 30_000 })
    })
  } finally {
    await test.step('Clean up stack', async () => {
      await deleteStack(page, displayName)
    })
  }
})
