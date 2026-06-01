import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { CheckPrerequisiteEndpoint, EnvironmentVariableValue, PrerequisiteConfig, PrerequisiteType } from 'common'
import { Prerequisite, PrerequisiteCheckResult, StackConfig } from 'common'

import { CryptoService } from '../../../utils/crypto-service.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'
import { runCli } from '../../../utils/run-cli.js'

const COMMAND_TIMEOUT = 30_000

type CheckResult = { satisfied: boolean; output: string }

/**
 * `gh` honors these env vars to suppress its interactive prompts and the
 * "newer version available" notifier that occasionally talks to the network.
 */
const GH_ENV: Record<string, string | undefined> = {
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
}

/**
 * Compares two semver-like version strings (e.g. "18.2.0" >= "18.0.0").
 * Returns true if `actual` >= `required`.
 */
const isVersionSatisfied = (actual: string, required: string): boolean => {
  const parse = (v: string) => v.split('.').map((p) => parseInt(p, 10) || 0)
  const a = parse(actual)
  const r = parse(required)
  const len = Math.max(a.length, r.length)
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const rv = r[i] ?? 0
    if (av > rv) return true
    if (av < rv) return false
  }
  return true
}

/**
 * Extracts a semver-like version (x.y.z) from a string like "v18.19.0" or "1.22.22".
 */
const extractVersion = (output: string): string | null => {
  const match = /(\d+\.\d+(?:\.\d+)?)/.exec(output)
  return match?.[1] ?? null
}

const checkNode = async (config: { minimumVersion: string }): Promise<CheckResult> => {
  const { stdout } = await runCli('node', ['--version'], { timeoutMs: COMMAND_TIMEOUT })
  const version = extractVersion(stdout.trim())
  if (!version) {
    return { satisfied: false, output: `Could not parse Node.js version from: ${stdout.trim()}` }
  }
  const isSatisfied = isVersionSatisfied(version, config.minimumVersion)
  return {
    satisfied: isSatisfied,
    output: isSatisfied
      ? `Node.js ${version} >= ${config.minimumVersion}`
      : `Node.js ${version} < ${config.minimumVersion}`,
  }
}

const checkYarn = async (config: { minimumVersion: string }): Promise<CheckResult> => {
  // Yarn ships as `yarn.cmd` / `yarn.ps1` shims on Windows, which `spawn` cannot
  // resolve directly without `shell: true`. Route through cmd.exe so PATHEXT
  // applies. POSIX uses runCli directly to avoid an extra fork.
  const isWindows = process.platform === 'win32'
  const { stdout } = isWindows
    ? await runCli('cmd.exe', ['/c', 'yarn', '--version'], { timeoutMs: COMMAND_TIMEOUT })
    : await runCli('yarn', ['--version'], { timeoutMs: COMMAND_TIMEOUT })
  const version = extractVersion(stdout.trim())
  if (!version) {
    return { satisfied: false, output: `Could not parse Yarn version from: ${stdout.trim()}` }
  }
  const isSatisfied = isVersionSatisfied(version, config.minimumVersion)
  return {
    satisfied: isSatisfied,
    output: isSatisfied ? `Yarn ${version} >= ${config.minimumVersion}` : `Yarn ${version} < ${config.minimumVersion}`,
  }
}

const checkDotnetSdk = async (config: { version: string }): Promise<CheckResult> => {
  const { stdout } = await runCli('dotnet', ['--list-sdks'], { timeoutMs: COMMAND_TIMEOUT })
  const lines = stdout.trim().split('\n')
  const isSatisfied = lines.some((line) => line.startsWith(config.version))
  return {
    satisfied: isSatisfied,
    output: isSatisfied
      ? `Dotnet SDK ${config.version} is installed`
      : `Dotnet SDK ${config.version} not found. Installed: ${lines.map((l) => l.split(' ')[0]).join(', ') || 'none'}`,
  }
}

const checkDotnetRuntime = async (config: { version: string }): Promise<CheckResult> => {
  const { stdout } = await runCli('dotnet', ['--list-runtimes'], { timeoutMs: COMMAND_TIMEOUT })
  const lines = stdout.trim().split('\n')
  const isSatisfied = lines.some((line) => line.includes(config.version))
  return {
    satisfied: isSatisfied,
    output: isSatisfied
      ? `Dotnet Runtime ${config.version} is installed`
      : `Dotnet Runtime ${config.version} not found`,
  }
}

const checkNugetFeed = async (config: { feedUrl: string; feedName?: string }): Promise<CheckResult> => {
  const { stdout } = await runCli('dotnet', ['nuget', 'list', 'source'], { timeoutMs: COMMAND_TIMEOUT })
  const isSatisfied = stdout.includes(config.feedUrl)
  return {
    satisfied: isSatisfied,
    output: isSatisfied
      ? `NuGet feed ${config.feedName ?? config.feedUrl} is configured`
      : `NuGet feed ${config.feedUrl} not found in configured sources`,
  }
}

const checkGit = async (): Promise<CheckResult> => {
  const { stdout } = await runCli('git', ['--version'], { timeoutMs: COMMAND_TIMEOUT })
  return { satisfied: true, output: stdout.trim() }
}

const checkGithubCli = async (): Promise<CheckResult> => {
  const { stdout, stderr } = await runCli('gh', ['auth', 'status'], {
    timeoutMs: COMMAND_TIMEOUT,
    env: GH_ENV,
  })
  const output = (stdout || stderr).trim()
  return { satisfied: true, output }
}

const checkEnvVariable = (
  config: { variableName: string },
  configuredValue?: EnvironmentVariableValue,
  crypto?: CryptoService,
): CheckResult => {
  if (configuredValue?.source === 'custom' && configuredValue.customValue !== undefined) {
    if (crypto && crypto.isEncrypted(configuredValue.customValue)) {
      try {
        crypto.decrypt(configuredValue.customValue)
        return {
          satisfied: true,
          output: `Environment variable ${config.variableName} is configured with an encrypted custom value`,
        }
      } catch {
        return {
          satisfied: false,
          output: `Environment variable ${config.variableName} has a custom value but decryption failed`,
        }
      }
    }
    return { satisfied: true, output: `Environment variable ${config.variableName} is configured with a custom value` }
  }

  const value = process.env[config.variableName]
  if (value !== undefined) {
    const label = configuredValue?.source === 'inherit' ? 'set (inherited)' : 'set'
    return { satisfied: true, output: `Environment variable ${config.variableName} is ${label}` }
  }

  return { satisfied: false, output: `Environment variable ${config.variableName} is not set` }
}

const checkCustomScript = async (config: { script: string }): Promise<CheckResult> => {
  const isWindows = process.platform === 'win32'
  const shell = isWindows ? 'cmd.exe' : '/bin/sh'
  const shellFlag = isWindows ? '/c' : '-c'
  // No env hardening here — user scripts are expected to honour the host env.
  // The process-group kill in runCli still bounds the runtime if the script hangs.
  const { stdout, stderr } = await runCli(shell, [shellFlag, config.script], { timeoutMs: COMMAND_TIMEOUT })
  return { satisfied: true, output: (stdout || stderr).trim() }
}

export const runCheck = async (
  type: PrerequisiteType,
  config: PrerequisiteConfig,
  options?: { envVarConfig?: EnvironmentVariableValue; crypto?: CryptoService },
): Promise<CheckResult> => {
  switch (type) {
    case 'node':
      return checkNode(config as { minimumVersion: string })
    case 'yarn':
      return checkYarn(config as { minimumVersion: string })
    case 'dotnet-sdk':
      return checkDotnetSdk(config as { version: string })
    case 'dotnet-runtime':
      return checkDotnetRuntime(config as { version: string })
    case 'nuget-feed':
      return checkNugetFeed(config as { feedUrl: string; feedName?: string })
    case 'git':
      return checkGit()
    case 'github-cli':
      return checkGithubCli()
    case 'env-variable':
      return checkEnvVariable(config as { variableName: string }, options?.envVarConfig, options?.crypto)
    case 'custom-script':
      return checkCustomScript(config as { script: string })
    default:
      return { satisfied: false, output: `Unknown prerequisite type: ${type as string}` }
  }
}

export const CheckPrerequisiteAction: RequestAction<CheckPrerequisiteEndpoint> = async ({ injector, getUrlParams }) => {
  const logger = getLogger(injector).withScope('CheckPrerequisite')
  const { id } = getUrlParams()

  const repository = getRepository(injector)
  const depDs = repository.getDataSetFor(Prerequisite, 'id')
  const results = await depDs.find(injector, { filter: { id: { $eq: id } }, top: 1 })
  const prereq = results[0]

  if (!prereq) {
    throw new RequestError('Prerequisite not found', 404)
  }

  let envVarConfig: EnvironmentVariableValue | undefined
  if (prereq.type === 'env-variable') {
    const varName = (prereq.config as { variableName: string }).variableName
    const stackConfigs = await repository
      .getDataSetFor(StackConfig, 'stackName')
      .find(injector, { filter: { stackName: { $eq: prereq.stackName } }, top: 1 })
    envVarConfig = stackConfigs[0]?.environmentVariables?.[varName]
  }

  const checkResultDs = repository.getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')

  await checkResultDs.update(injector, id, { status: 'checking' }).catch((e) => {
    void logger.verbose({
      message: 'Could not update check result to "checking" (entry may not exist yet)',
      data: { prerequisiteId: id, error: e },
    })
  })

  const crypto = injector.get(CryptoService)
  try {
    const result = await runCheck(prereq.type, prereq.config, { envVarConfig, crypto })
    const checkUpdate = {
      status: result.satisfied ? ('satisfied' as const) : ('failed' as const),
      output: result.output,
      checkedAt: new Date().toISOString(),
    }

    const existing = await checkResultDs.find(injector, { filter: { prerequisiteId: { $eq: id } }, top: 1 })
    if (existing.length > 0) {
      await checkResultDs.update(injector, id, checkUpdate)
    } else {
      await checkResultDs.add(injector, { prerequisiteId: id, ...checkUpdate })
    }

    if (result.satisfied) {
      await logger.information({
        message: `Prerequisite check passed: ${prereq.name}`,
        data: { output: result.output },
      })
    } else {
      await logger.warning({ message: `Prerequisite check failed: ${prereq.name}`, data: { output: result.output } })
    }
    return JsonResult(result)
  } catch (error) {
    const output = error instanceof Error ? error.message : 'Check failed'

    const existing = await checkResultDs.find(injector, { filter: { prerequisiteId: { $eq: id } }, top: 1 })
    if (existing.length > 0) {
      await checkResultDs.update(injector, id, { status: 'failed', output, checkedAt: new Date().toISOString() })
    } else {
      await checkResultDs.add(injector, {
        prerequisiteId: id,
        status: 'failed',
        output,
        checkedAt: new Date().toISOString(),
      })
    }

    await logger.warning({ message: `Prerequisite check failed: ${prereq.name}`, data: { error } })
    return JsonResult({ satisfied: false, output })
  }
}
