import * as Git from 'simple-git'
import * as GitHub from '@octokit/rest'
import * as Actions from '@actions/core'
import * as Os from 'node:os'
import type * as Types from './types.js'
import {IsDebug} from './debug.js'

function CreateGitHubInstance(ProgramOptions: Types.ProgramOptionsType): GitHub.Octokit {
	const GitHubInstance = new GitHub.Octokit({auth: ProgramOptions.ghToken})
	return GitHubInstance
}

function CreateGitInstance(BasePath: string): Git.SimpleGit {
	const GitInstance = Git.simpleGit(BasePath, {maxConcurrentProcesses: Os.cpus().length})
	return GitInstance
}

/**
 * @name ListBranches
 * @description List all branches that should be purged.
 * @param {Types.ProgramOptions} ProgramOptions The program options.
 * @returns {string[]} A list of branches. The list always contains 'latest' and the current/default branch.
 */
export async function ListBranches(ProgramOptions: Types.ProgramOptionsType): Promise<string[]> {
	const Branches: string[] = ['latest']
	if (ProgramOptions.shouldUseApi) {
		const GitHubInstance = CreateGitHubInstance(ProgramOptions)
		const [RepoOwner, RepoName] = ProgramOptions.repo.split('/')
		Branches.push((await GitHubInstance.repos.get({owner: RepoOwner, repo: RepoName})).data.default_branch)
		const OtherBranches = (await GitHubInstance.repos.listBranches({owner: RepoOwner, repo: RepoName}).then(Branches => Branches.data))
			.map(Item => Item.name)
		OtherBranches.forEach(Item => Branches.push(ProgramOptions.branch.split(' ').find(Branch => Branch === Item)))
	}

	if (!ProgramOptions.shouldUseApi) {
		const GitInstance = CreateGitInstance(ProgramOptions.ciWorkspacePath)
		Branches.push(await GitInstance.branchLocal().then(Branches => Branches.current))
		// Branches[1] is always the current/default branch.
		const OtherBranches = (await GitInstance.branchLocal().then(Branches => Branches.all)).filter(Branch => Branch !== Branches[1])
		OtherBranches.forEach(Item => Branches.push(ProgramOptions.branch.split(' ').find(Branch => Branch === Item)))
	}

	if (IsDebug(ProgramOptions)) {
		Actions.debug(`ListBranches in branches.ts called: ${JSON.stringify(Branches)}`)
	}

	return Branches.filter(Branch => Branch !== undefined && Branch !== null)
}
