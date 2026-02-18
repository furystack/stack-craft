import type { Injector } from '@furystack/inject'
import { LocationService } from '@furystack/shades'

/**
 * Navigate to a path using Shades routing. Use this instead of raw history.pushState.
 */
export const navigate = (injector: Injector, path: string): void => {
  history.pushState(null, '', path)
  injector.getInstance(LocationService).updateState()
}
