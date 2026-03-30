import type { ChildProcess } from 'child_process'

import type { ProcessRunner } from './process-runner.js'

export const attachProcessIO = (child: ChildProcess, serviceId: string, runner: ProcessRunner): void => {
  child.stdout?.on('data', (data: Buffer) => {
    data
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => runner.addLogLine(serviceId, 'stdout', line))
  })
  child.stderr?.on('data', (data: Buffer) => {
    data
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => runner.addLogLine(serviceId, 'stderr', line))
  })
}
