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
  4. Verify that the service is running
  5. Verify that the service is logging to the console
  6. The dog has eaten the food. Woof woof!

  `

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

  // Start the service (click the primary action in the header, not the stepper)
  await page.getByTestId('page-header-actions').getByRole('button', { name: 'Start' }).click()

  // Wait for the service to reach running state
  await expect(page.locator('shade-service-status-indicator')).toContainText('Running')

  // Navigate to the Logs tab via the tab bar
  await page.getByTestId('service-detail-tabs').getByRole('tab', { name: 'Logs' }).click()
  await expect(page.locator('shade-service-logs-tab')).toBeVisible()

  // Verify that the log viewer is present with entries
  await expect(page.locator('shade-service-logs-tab shade-log-viewer')).toBeVisible()
  await expect(page.locator('shade-service-logs-tab shade-log-viewer')).not.toContainText('No log output yet.')
})
