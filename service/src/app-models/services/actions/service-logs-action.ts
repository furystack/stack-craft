import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceLogsEndpoint } from 'common'
import { LogStorageService } from '../../../services/log-storage-service.js'

export const ServiceLogsAction: RequestAction<ServiceLogsEndpoint> = async ({ injector, getUrlParams, getQuery }) => {
  const { id: serviceId } = getUrlParams()
  const { lines: lineCount, processUid, search } = getQuery()

  const logStorage = injector.get(LogStorageService)
  const parsedLimit = lineCount ? Number(lineCount) : undefined
  const entries = await logStorage.getEntries(serviceId, {
    limit: parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    processUid,
    search,
  })

  return JsonResult({ entries })
}
