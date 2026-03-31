import type { ServiceView } from 'common'

export const isServiceReady = (svc: ServiceView): boolean => {
  const cloneOk = !svc.repositoryId || svc.cloneStatus === 'cloned'
  const installOk = !svc.installCommand || svc.installStatus === 'installed'
  const buildOk = !svc.buildCommand || svc.buildStatus === 'built'
  return cloneOk && installOk && buildOk
}
