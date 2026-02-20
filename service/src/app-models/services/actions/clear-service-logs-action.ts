import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ClearServiceLogsEndpoint } from 'common'
import { LogStorageService } from '../../../services/log-storage-service.js'

export const ClearServiceLogsAction: RequestAction<ClearServiceLogsEndpoint> = async ({
  injector,
  getUrlParams,
}) => {
  const { id: serviceId } = getUrlParams()
  const logStorage = injector.getInstance(LogStorageService)
  await logStorage.clearLogs(serviceId)
  return JsonResult({ success: true })
}
