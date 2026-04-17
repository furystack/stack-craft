import type { TriggerSource } from 'common'

export type TriggerContext = {
  triggeredBy: string
  triggerSource: TriggerSource
}
