import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceLogsEndpoint } from 'common'
import { ProcessManager } from '../../../services/process-manager.js'

export const ServiceLogsAction: RequestAction<ServiceLogsEndpoint> = async ({ injector, getUrlParams, getQuery }) => {
  const { id: serviceId } = getUrlParams()
  const { lines: lineCount } = getQuery()

  const pm = injector.getInstance(ProcessManager)
  const lines = pm.getLogLines(serviceId, lineCount ? Number(lineCount) : undefined)

  return JsonResult({ lines })
}
