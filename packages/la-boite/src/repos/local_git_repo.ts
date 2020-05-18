import { GitProcess, IGitResult } from 'dugite'
import { CommandBus } from 'git-en-boite-command-bus'
import { GitRepo, Reference } from './interfaces'
import fs from 'fs'
import {
  Init,
  Commit,
  Misc,
  EnsureBranchExists,
  GetRevision,
  GitOperation,
  SetOrigin,
} from 'git-en-boite-core-port-git'

const handleInit = async (repo: LocalGitRepo, command: Init) => {
  await repo.execGit('init', ...(command.isBare ? ['--bare'] : []))
  await repo.execGit('config', 'gc.auto', '0')
  await repo.execGit('config', 'gc.pruneExpire', 'never') // don't prune objects if GC runs
}

const handleSetOrigin = async (repo: LocalGitRepo, command: SetOrigin) => {
  const { url } = command
  await repo.execGit('remote', 'add', 'origin', url)
}

const handleCommit = async (repo: LocalGitRepo, command: Commit) => {
  const { message } = command
  await repo.execGit('config', 'user.email', 'test@example.com')
  await repo.execGit('config', 'user.name', 'Test User')
  await repo.execGit('commit', '--allow-empty', '-m', message)
}

const handleMisc = async (repo: LocalGitRepo, { command, args }: Misc) =>
  repo.execGit(command, ...args)

const handleEnsureBranchExists = async (repo: LocalGitRepo, { name }: EnsureBranchExists) => {
  const verifyBranchExists = await repo.execGit('rev-parse', '--verify', name)
  if (!(verifyBranchExists.exitCode === 0)) await repo.execGit('branch', name, 'HEAD')
}

const handleGetRevision = async (repo: LocalGitRepo, { reference }: GetRevision): Promise<string> =>
  (await repo.execGit('rev-parse', reference)).stdout.trim()

export class LocalGitRepo implements GitRepo {
  path: string

  static async openForCommands(path: string) {
    const repo = await this.open(path)
    const commandBus = new CommandBus<LocalGitRepo, GitOperation>(repo)
    commandBus.handle(Init, handleInit)
    commandBus.handle(SetOrigin, handleSetOrigin)
    commandBus.handle(Commit, handleCommit)
    commandBus.handle(Misc, handleMisc)
    commandBus.handle(EnsureBranchExists, handleEnsureBranchExists)
    commandBus.handle(GetRevision, handleGetRevision)
    return commandBus.do.bind(commandBus)
  }

  static async open(path: string) {
    fs.mkdirSync(path, { recursive: true })
    return new this(path)
  }

  protected constructor(path: string) {
    this.path = path
  }

  async execGit(cmd: string, ...args: string[]): Promise<IGitResult> {
    return await GitProcess.exec([cmd, ...args], this.path)
  }

  async refs(): Promise<Reference[]> {
    const { stdout } = await this.execGit('show-ref')
    return stdout
      .trim()
      .split('\n')
      .map(line => line.trim().split(' '))
      .map(([revision, name]) => ({ revision, name }))
  }
}
