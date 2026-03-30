import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

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

  // Create stack
  await page.locator('button, a', { hasText: 'Create Stack' }).first().click()
  await expect(page.locator('shade-create-stack')).toBeVisible()

  await page.locator('input[name="name"]').fill(stackName)
  await page.locator('input[name="displayName"]').fill(displayName)
  await page.locator('textarea[name="description"]').fill(description)
  await page.locator('input[name="mainDirectory"]').fill('/tmp/e2e-test')
  await page.locator('button', { hasText: 'Create' }).click()

  await expect(page.locator('shade-noty-list')).toContainText(`Stack "${displayName}" was created successfully.`)

  await expect(page.locator('shade-dashboard')).toBeVisible()

  await expect(page.getByTestId('page-header-title')).toContainText(displayName)

  // Navigate to services list via the dashboard card's "View All" link
  await page.locator('shade-dashboard a', { hasText: 'View All' }).first().click()
  await expect(page.locator('shade-services-list')).toBeVisible()
  await page.locator('button', { hasText: 'Create Service' }).first().click()
  await expect(page.locator('shade-create-service-wizard')).toBeVisible()

  await page.locator('input[name="displayName"]').fill('StackCraft DOG FOODING TIME!')
  await page.locator('input[name="workingDirectory"]').fill(workingDirectory)
  await page.locator('input[name="runCommand"]').fill('yarn start:service')

  // --- Add realistic prerequisites inline ---

  const prereqForm = page.locator('shade-prerequisite-form')

  const typeSelect = page.locator('shade-select').filter({ has: page.locator('input[name="type"]') })

  // Prerequisite 1: Node.js >= 22
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Node.js >= 22')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Node.js' }).click()
  await prereqForm.locator('input[name="minimumVersion"]').fill('22.0.0')
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Node.js >= 22" was added.')

  // Prerequisite 2: Yarn >= 4
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Yarn >= 4')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Yarn' }).click()
  await prereqForm.locator('input[name="minimumVersion"]').fill('4.0.0')
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Yarn >= 4" was added.')

  // Prerequisite 3: Git
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Git')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Git' }).first().click()
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Git" was added.')

  // Prerequisite 4: MOCK_API_KEY (plain text environment variable)
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Mock API Key')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Environment Variable' }).click()
  await prereqForm.locator('input[name="variableName"]').fill('MOCK_API_KEY')
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Mock API Key" was added.')

  // Prerequisite 5: STACK_CRAFT_ENCRYPTION_KEY (confidential environment variable)
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Encryption Key')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Environment Variable' }).click()
  await prereqForm.locator('input[name="variableName"]').fill('STACK_CRAFT_ENCRYPTION_KEY')
  await prereqForm.locator('input[name="isSensitive"]').check()
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Encryption Key" was added.')

  // Prerequisite 6: DATABASE_URL (required by the service to connect to Postgres)
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Database URL')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Environment Variable' }).click()
  await prereqForm.locator('input[name="variableName"]').fill('DATABASE_URL')
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Database URL" was added.')

  // Prerequisite 7: APP_SERVICE_PORT (used to override the port for the dogfooding instance)
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('Service Port')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Environment Variable' }).click()
  await prereqForm.locator('input[name="variableName"]').fill('APP_SERVICE_PORT')
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"Service Port" was added.')

  // Prerequisite 8: MCP_PORT (must differ from the test host's MCP port to avoid conflict)
  await page.locator('button', { hasText: 'Add Prerequisite' }).click()
  await expect(prereqForm).toBeVisible()
  await prereqForm.locator('input[name="name"]').fill('MCP Port')
  await typeSelect.locator('.select-trigger').click()
  await typeSelect.locator('.dropdown-item', { hasText: 'Environment Variable' }).click()
  await prereqForm.locator('input[name="variableName"]').fill('MCP_PORT')
  await prereqForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"MCP Port" was added.')

  // --- Add local .env file override ---
  await page.locator('button', { hasText: 'Add Local File' }).click()
  await page.locator('input[placeholder="Relative path (e.g. .env)"]').fill('.env')
  await page.locator('textarea[placeholder="File content"]').fill('STACK_CRAFT_ENCRYPTION_KEY=e2e-dogfooding-test-key')

  // Add StackCraft GitHub repository inline
  await page.locator('button', { hasText: 'New' }).click()
  const repoForm = page.locator('shade-github-repo-form')
  await expect(repoForm).toBeVisible()
  await repoForm.locator('input[name="url"]').fill('https://github.com/furystack/stack-craft')
  await repoForm.locator('input[name="displayName"]').fill('StackCraft')
  await repoForm.locator('button', { hasText: 'Add' }).click()
  await expect(page.locator('shade-noty-list')).toContainText('"StackCraft" was added.')

  // Select the newly created repository
  const repoSelect = page.locator('shade-select').filter({ has: page.locator('input[name="repositoryId"]') })
  await repoSelect.locator('.select-trigger').click()
  await repoSelect.locator('.dropdown-item', { hasText: 'StackCraft' }).click()

  await page.locator('input[name="installCommand"]').fill('yarn install')
  await page.locator('input[name="buildCommand"]').fill('yarn build')
  await page.locator('input[name="runCommand"]').fill('yarn start:service')

  await page.locator('button', { hasText: 'Create' }).click()

  // Step 2: Set up the service (clone, install, build)
  await page.locator('button', { hasText: 'Set up now' }).click()

  // Clone + install + build may take several minutes
  await expect(page.getByText('Service set up successfully!')).toBeVisible({ timeout: 10 * 60 * 1000 })

  // Navigate to the service detail
  await page.locator('button', { hasText: 'View Service' }).click()
  await expect(page.locator('shade-service-detail')).toBeVisible()

  // ======================================================================
  // Step 3: First start attempt — expect failure (port 9090 already in use)
  // ======================================================================

  await page.getByTestId('page-header-actions').getByRole('button', { name: 'Start' }).click()

  // The spawned service will try to bind to port 9090 (default), which is
  // already occupied by the test host. Expect status to transition to Error.
  await expect(page.getByTestId('service-status-indicator')).toContainText('Error', { timeout: 60_000 })

  // Navigate to Logs and verify the error is visible
  await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Logs' }).click()
  await expect(page.locator('shade-service-logs-tab')).toBeVisible()

  const logViewer = page.locator('shade-service-logs-tab shade-log-viewer')
  await expect(logViewer).toBeVisible()
  await expect(logViewer).toContainText(/EADDRINUSE|address already in use/, { timeout: 10_000 })

  // ======================================================================
  // Step 4: Set APP_SERVICE_PORT env override to a unique port and restart
  // ======================================================================

  // Navigate to the Configuration tab
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

  // Wait for the service to reach running state on the new port
  await expect(page.getByTestId('service-status-indicator')).toContainText('Running', { timeout: 60_000 })

  // ======================================================================
  // Step 5: Verify logs and fire an HTTP request to the running service
  // ======================================================================

  await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Logs' }).click()
  await expect(page.locator('shade-service-logs-tab')).toBeVisible()

  const successLogViewer = page.locator('shade-service-logs-tab shade-log-viewer')
  await expect(successLogViewer).toBeVisible()
  await expect(successLogViewer).not.toContainText('No log output yet.')

  // Verify the service is actually reachable on the new port
  await expect(async () => {
    const response = await page.request.get(`http://localhost:${dogfoodingPort}`)
    expect(response.status()).toBe(200)
  }).toPass({ timeout: 30_000 })

  // ======================================================================
  // Step 6: Stop the service and remove the stack
  // ======================================================================

  // Stop the running service (SIGTERM may cause non-zero exit → "Error" or clean → "Stopped")
  await page.getByTestId('page-header-actions').getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByTestId('service-status-indicator')).toContainText(/Stopped|Error/, { timeout: 30_000 })

  // Navigate to the main dashboard, then to the stack, then to Edit Stack
  await page.locator('shade-sidebar-item a', { hasText: 'Dashboard' }).click()
  await expect(page.locator('stack-list-dashboard')).toBeVisible()

  await page.locator('stack-list-dashboard shade-card', { hasText: displayName }).click()
  await expect(page.getByTestId('page-header-title')).toContainText(displayName)

  await page.locator('a', { hasText: 'Edit Stack' }).click()
  await expect(page.locator('shade-edit-stack')).toBeVisible()

  // Delete the stack
  await page.locator('button', { hasText: 'Delete Stack' }).click()
  await page.locator('shade-dialog .dialog-confirm-btn').click()

  await expect(page.locator('shade-noty-list')).toContainText(`"${displayName}" was deleted.`)
  await expect(page.locator('shade-dashboard')).toBeVisible({ timeout: 10_000 })
})
