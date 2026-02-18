import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { CheckDependencyEndpoint } from 'common'
import { Dependency } from 'common'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const CheckDependencyAction: RequestAction<CheckDependencyEndpoint> = async ({ injector, getUrlParams }) => {
  const logger = getLogger(injector).withScope('CheckDependency')
  const { id } = getUrlParams()

  const depDs = getRepository(injector).getDataSetFor(Dependency, 'id')
  const results = await depDs.find(injector, { filter: { id: { $eq: id } }, top: 1 })
  const dep = results[0]

  if (!dep) {
    throw new RequestError('Dependency not found', 404)
  }

  try {
    const { stdout, stderr } = await execFileAsync('/bin/sh', ['-c', dep.checkCommand], { timeout: 30000 })
    const output = (stdout || stderr).trim()
    await logger.information({ message: `Dependency check passed: ${dep.name}`, data: { output } })
    return JsonResult({ satisfied: true, output })
  } catch (error) {
    const output = error instanceof Error ? error.message : 'Check command failed'
    await logger.warning({ message: `Dependency check failed: ${dep.name}`, data: { error } })
    return JsonResult({ satisfied: false, output })
  }
}
