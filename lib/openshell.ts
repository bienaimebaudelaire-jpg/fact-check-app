import { execFile } from 'node:child_process'
import type {
  OpenShellCommand,
  OpenShellResult,
  OpenShellRunOptions,
  OpenShellRunner,
} from './openshell-types'

export const OPENSHELL_DEFAULT_BINARY = 'openshell'
export const OPENSHELL_DEFAULT_TIMEOUT_MS = 30_000

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/
const SAFE_MEMORY = /^[1-9][0-9]{0,5}(Mi|Gi)$/

function token(label: string, value: string): string {
  if (!SAFE_TOKEN.test(value)) throw new Error(`OpenShell: invalid ${label}`)
  return value
}

/** Builds the argv for an OpenShell command. Arguments are validated; no shell is ever involved. */
export function buildOpenShellArgs(cmd: OpenShellCommand): string[] {
  switch (cmd.kind) {
    case 'sandbox-list':
      return ['sandbox', 'list']
    case 'sandbox-delete':
      return ['sandbox', 'delete', token('sandbox name', cmd.name)]
    case 'sandbox-create': {
      const args = ['sandbox', 'create']
      if (cmd.from !== undefined) args.push('--from', token('image', cmd.from))
      if (cmd.name !== undefined) args.push('--name', token('sandbox name', cmd.name))
      if (cmd.cpu !== undefined) {
        if (!Number.isInteger(cmd.cpu) || cmd.cpu < 1 || cmd.cpu > 64) throw new Error('OpenShell: invalid cpu')
        args.push('--cpu', String(cmd.cpu))
      }
      if (cmd.memory !== undefined) {
        if (!SAFE_MEMORY.test(cmd.memory)) throw new Error('OpenShell: invalid memory')
        args.push('--memory', cmd.memory)
      }
      return args
    }
    case 'sandbox-exec': {
      if (cmd.command.length === 0) throw new Error('OpenShell: empty command')
      return ['exec', token('sandbox name', cmd.name), '--', ...cmd.command]
    }
  }
}

const defaultRunner: OpenShellRunner = (binary, args, { timeoutMs }) =>
  new Promise((resolve) => {
    execFile(binary, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024, shell: false }, (error, stdout, stderr) => {
      const code = error ? (typeof (error as { code?: unknown }).code === 'number' ? ((error as { code: number }).code) : null) : 0
      resolve({ exitCode: code, stdout: String(stdout ?? ''), stderr: String(stderr || (error ? error.message : '')) })
    })
  })

/** Runs an OpenShell command. Never throws on CLI failure (ok=false); throws only on invalid arguments. */
export async function runOpenShell(
  cmd: OpenShellCommand,
  options: OpenShellRunOptions = {},
  runner: OpenShellRunner = defaultRunner,
): Promise<OpenShellResult> {
  const args = buildOpenShellArgs(cmd)
  const binary = options.binary ?? process.env.OPENSHELL_BIN ?? OPENSHELL_DEFAULT_BINARY
  const res = await runner(binary, args, { timeoutMs: options.timeoutMs ?? OPENSHELL_DEFAULT_TIMEOUT_MS })
  return { ok: res.exitCode === 0, exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr, argv: [binary, ...args] }
}
