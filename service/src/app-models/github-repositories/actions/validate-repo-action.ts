import { GitHubRepositoryDataSet } from '../../data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ValidateRepoEndpoint } from 'common'

import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

export const ValidateRepoAction: RequestAction<ValidateRepoEndpoint> = async ({ injector, getUrlParams }) => {
  const logger = getLogger(injector).withScope('ValidateRepo')
  const { id } = getUrlParams()

  const repoDs = getDataSetFor(injector, GitHubRepositoryDataSet)
  const results = await repoDs.find(injector, { filter: { id: { $eq: id } }, top: 1 })
  const repo = results[0]

  if (!repo) {
    throw new RequestError('Repository not found', 404)
  }

  try {
    await execFileAsync('git', ['ls-remote', '--exit-code', repo.url], { timeout: 15000 })
    await logger.information({ message: `Repository validated: ${repo.url}` })
    return JsonResult({ accessible: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logger.warning({ message: `Repository not accessible: ${repo.url}`, data: { error } })
    return JsonResult({ accessible: false, message })
  }
}
