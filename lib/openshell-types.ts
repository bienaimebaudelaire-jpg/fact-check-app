export type OpenShellCommand =
  | { kind: 'sandbox-create'; name?: string; from?: string; cpu?: number; memory?: string }
  | { kind: 'sandbox-list' }
  | { kind: 'sandbox-delete'; name: string }
  | { kind: 'sandbox-exec'; name: string; command: string[] }

export type OpenShellRunOptions = {
  binary?: string
  timeoutMs?: number
}

export type OpenShellResult = {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  argv: string[]
}

export type OpenShellRunner = (
  binary: string,
  args: string[],
  options: { timeoutMs: number },
) => Promise<{ exitCode: number | null; stdout: string; stderr: string }>
