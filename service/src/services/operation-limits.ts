import { defineService, type Token } from '@furystack/inject'
import { Semaphore } from '@furystack/utils'

const DEFAULTS = {
  GIT: 10,
  INSTALL: 3,
  BUILD: 1,
} as const

const parseLimit = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback
}

/**
 * Caps concurrent git CLI operations (clone, fetch, pull, ls-remote, branch
 * reads). Network-bound so a moderately high default is fine; the cap mainly
 * prevents the periodic `GitWatcher` from saturating the system when many
 * services share a stack.
 *
 * Tunable via `STACK_CRAFT_MAX_PARALLEL_GIT` (default 10).
 */
export const GitOperationLimit: Token<Semaphore, 'singleton'> = defineService({
  name: 'app/GitOperationLimit',
  lifetime: 'singleton',
  factory: () => new Semaphore(parseLimit(process.env.STACK_CRAFT_MAX_PARALLEL_GIT, DEFAULTS.GIT)),
})

/**
 * Caps concurrent install operations across services. Installs are
 * network-and-disk heavy and frequently write to shared package caches
 * (yarn/pnpm/npm/nuget), where concurrent writers can race.
 *
 * Tunable via `STACK_CRAFT_MAX_PARALLEL_INSTALLS` (default 3).
 */
export const InstallOperationLimit: Token<Semaphore, 'singleton'> = defineService({
  name: 'app/InstallOperationLimit',
  lifetime: 'singleton',
  factory: () => new Semaphore(parseLimit(process.env.STACK_CRAFT_MAX_PARALLEL_INSTALLS, DEFAULTS.INSTALL)),
})

/**
 * Caps concurrent build operations across services. Builds are CPU-bound and
 * each one already saturates multiple cores (tsc -b, webpack, dotnet build, …),
 * so running more than a handful in parallel typically thrashes the machine.
 *
 * Tunable via `STACK_CRAFT_MAX_PARALLEL_BUILDS` (default 1).
 */
export const BuildOperationLimit: Token<Semaphore, 'singleton'> = defineService({
  name: 'app/BuildOperationLimit',
  lifetime: 'singleton',
  factory: () => new Semaphore(parseLimit(process.env.STACK_CRAFT_MAX_PARALLEL_BUILDS, DEFAULTS.BUILD)),
})
