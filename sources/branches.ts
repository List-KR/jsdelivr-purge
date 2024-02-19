import * as Git from 'simple-git'
import * as GitHub from '@octokit/rest'
import * as Actions from '@actions/core'
import * as Os from 'node:os'
import type * as Types from './types.js'
import {IsDebug} from './debug.js'

function CreateGitInstance(BasePath: string): Git.SimpleGit {
	const GitInstance = Git.simpleGit(BasePath, {maxConcurrentProcesses: Os.cpus().length})
	return GitInstance
}

/**
 * @name ListBranches
 * @description List all branches that should be purged.
 * @param {Types.ProgramOptions} ProgramOptions The program options.
 * @returns {Promise<{Branches: string[]; Default: string}>} A list of branches and the default branch.
 */
export async function ListBranches(ProgramOptions: Types.ProgramOptionsType): Promise<{Branches: string[]; Default: string}> {
	var Branches: {Branches: string[]; Default: string} = {
		Branches: [],
		Default: '',
	}
	const GitInstance = CreateGitInstance(ProgramOptions.ciWorkspacePath)
	Branches.Default = await GitInstance.branchLocal().then(Branches => Branches.current)
	Branches.Branches.push(Branches.Default)
	// Branches[0] is always the current/default branch.
	const OtherBranches = (await GitInstance.branchLocal().then(Branches => Branches.all)).filter(Branch => Branch !== Branches[1])
	OtherBranches.forEach(Item => Branches.Branches.push(ProgramOptions.branch.split(' ').find(Branch => Branch === Item)))

	if (IsDebug(ProgramOptions)) {
		Actions.debug(`ListBranches in branches.ts called: ${JSON.stringify(Branches)}`)
	}

	Branches.Branches = Branches.Branches.filter(Branch => Branch !== undefined && Branch !== null)

	return Branches
}
