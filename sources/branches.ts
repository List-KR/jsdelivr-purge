import * as actions from '@actions/core'
import {availableParallelism} from 'node:os'
import {simpleGit} from 'simple-git'
import {isDebug} from './debug.js'
import type {branchSelection, programOptions} from './types.js'

export async function listBranches(options: programOptions): Promise<branchSelection> {
	const git = simpleGit(options.ciWorkspacePath, {maxConcurrentProcesses: availableParallelism()})
	const summary = await git.branch(['--all'])
	const defaultBranch = summary.current
	if (!defaultBranch) {
		throw new Error('Unable to determine the current/default branch')
	}

	const availableBranches = new Set(summary.all.map(branch => branch.replace(/^remotes\/[^/]+\//, '')))
	const requestedBranches = options.branch.split(/\s+/).filter(Boolean)
	const missingBranches = requestedBranches.filter(branch => !availableBranches.has(branch))
	if (missingBranches.length > 0) {
		throw new Error(`Git branches not found: ${missingBranches.join(', ')}`)
	}

	const branches = [...new Set([defaultBranch, ...requestedBranches])]
	const selection = {branches, defaultBranch}

	if (isDebug(options)) {
		actions.debug(`listBranches called: ${JSON.stringify(selection)}`)
	}

	return selection
}
