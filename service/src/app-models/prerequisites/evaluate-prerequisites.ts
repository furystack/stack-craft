import { useSystemIdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { EnvironmentVariableValue } from 'common'
import { Prerequisite, PrerequisiteCheckResult, StackConfig } from 'common'

import { runCheck } from './actions/check-prerequisite-action.js'
import { legacyRepository as getRepository } from '../../utils/legacy-repository.js'

/**
 * Evaluates all prerequisites on startup and populates the in-memory
 * {@link PrerequisiteCheckResult} store.  Results are pushed to every
 * connected frontend via entity-sync.
 */
export const evaluatePrerequisites = async (injector: Injector): Promise<void> => {
  const logger = getLogger(injector).withScope('EvaluatePrerequisites')
  const elevated = useSystemIdentityContext({ injector })

  try {
    const repository = getRepository(elevated)
    const prereqDs = repository.getDataSetFor(Prerequisite, 'id')
    const checkResultDs = repository.getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
    const stackConfigDs = repository.getDataSetFor(StackConfig, 'stackName')

    const prerequisites = await prereqDs.find(elevated, {})

    if (prerequisites.length === 0) {
      await logger.verbose({ message: 'No prerequisites to evaluate' })
      return
    }

    await logger.information({ message: `Evaluating ${prerequisites.length} prerequisite(s)…` })

    // Seed unchecked entries for every prerequisite
    for (const prereq of prerequisites) {
      await checkResultDs.add(elevated, {
        prerequisiteId: prereq.id,
        status: 'unchecked',
        output: '',
        checkedAt: '',
      })
    }

    // Pre-load all stack configs so env-variable checks can resolve configured values
    const allStackConfigs = await stackConfigDs.find(elevated, {})
    const stackConfigByName = new Map(allStackConfigs.map((sc) => [sc.stackName, sc]))

    for (const prereq of prerequisites) {
      await checkResultDs.update(elevated, prereq.id, { status: 'checking' })

      let envVarConfig: EnvironmentVariableValue | undefined
      if (prereq.type === 'env-variable') {
        const varName = (prereq.config as { variableName: string }).variableName
        envVarConfig = stackConfigByName.get(prereq.stackName)?.environmentVariables?.[varName]
      }

      try {
        const result = await runCheck(prereq.type, prereq.config, { envVarConfig })
        await checkResultDs.update(elevated, prereq.id, {
          status: result.satisfied ? 'satisfied' : 'failed',
          output: result.output,
          checkedAt: new Date().toISOString(),
        })
      } catch (error) {
        await checkResultDs.update(elevated, prereq.id, {
          status: 'failed',
          output: error instanceof Error ? error.message : 'Check failed',
          checkedAt: new Date().toISOString(),
        })
      }
    }

    await logger.information({ message: 'Prerequisite evaluation complete' })
  } finally {
    await elevated[Symbol.asyncDispose]()
  }
}
