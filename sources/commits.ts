import {availableParallelism} from 'node:os'
import {simpleGit} from 'simple-git'
import type {programOptions} from './types.js'

export async function getChangedFiles(options: programOptions, latestWorkflowTime: number, branch: string): Promise<string[]> {
	const git = simpleGit(options.ciWorkspacePath, {maxConcurrentProcesses: availableParallelism()})
	const branchNames = (await git.branch(['--all'])).all
	const branchRef = branchNames.find(name => name === branch || name.replace(/^remotes\/[^/]+\//, '') === branch)
	if (!branchRef) {
		throw new Error(`Git branch not found: ${branch}`)
	}

	const output = latestWorkflowTime === 0
		? await git.raw(['ls-tree', '-r', '--name-only', branchRef])
		: await git.raw(['log', branchRef, `--since=${new Date(latestWorkflowTime).toISOString()}`, '--name-only', '--pretty=format:'])

	return [...new Set(output.split('\n').filter(Boolean))]
}
