import * as Git from 'simple-git'
import * as GitHub from '@octokit/rest'
import * as Os from 'node:os'
import {DateTime} from 'luxon'
import type * as Types from './types.js'

function CreateGitHubInstance(ProgramOptions: Types.ProgramOptionsType): GitHub.Octokit {
	const GitHubInstance = new GitHub.Octokit({auth: ProgramOptions.ghToken})
	return GitHubInstance
}

function CreateGitInstance(BasePath: string): Git.SimpleGit {
	const GitInstance = Git.simpleGit(BasePath, {maxConcurrentProcesses: Os.cpus().length})
	return GitInstance
}

/**
 * @name ListCommitsFromLatestWorkflowTime
 * @description List commits using GitHub Octokit or simple-git.
 * @param {Types.ProgramOptionsType} ProgramOptions The program options.
 * @param {number} LatestWorkflowRunTime The latest workflow time in milliseconds.
 * @param {string} Branch The branch or tag name.
 * @returns {Promise<Types.CommitSHA>} SHA of the latest commit.
 */
export async function GetCommitSHAFromLatestWorkflowTime(ProgramOptions: Types.ProgramOptionsType, LatestWorkflowRunTime: number, Branch: string, DefaultBranch: string): Promise<Types.CommitSHA> {
	var MatchedCommitTimeAddress = 0
	if (ProgramOptions.shouldUseApi) {
		const GitHubInstance = CreateGitHubInstance(ProgramOptions)
		const GitHubListCommits = await GitHubInstance.repos.listCommits({
			owner: ProgramOptions.repo.split('/')[0],
			repo: ProgramOptions.repo.split('/')[1],
			sha: Branch === 'latest' ? DefaultBranch : Branch,
		}).then(Response => Response.data)
		for (const CommitRaw of GitHubListCommits) {
			if (DateTime.fromISO(CommitRaw.commit.author.date).toMillis() < LatestWorkflowRunTime) {
				break
			}

			MatchedCommitTimeAddress++
		}

		// If any commit is pushed after the latest workflow time, skip the branch.
		if (MatchedCommitTimeAddress === 0) {
			return {sha: '', length: 0}
		}

		// If the wokflow had not executed before, return SHA of the oldest commit.
		if (LatestWorkflowRunTime === 0) {
			return {sha: GitHubListCommits[GitHubListCommits.length - 1].sha, length: GitHubListCommits.length}
		}

		return {sha: GitHubListCommits[MatchedCommitTimeAddress].sha, length: GitHubListCommits.length}
	}

	if (!ProgramOptions.shouldUseApi) {
		const GitInstance = CreateGitInstance(ProgramOptions.ciWorkspacePath)
		const GitLog = (await GitInstance.log(['--date=iso-strict'])).all
		for (const CommitRaw of GitLog) {
			if (DateTime.fromISO(CommitRaw.date).toMillis() < LatestWorkflowRunTime) {
				break
			}

			MatchedCommitTimeAddress++
		}

		// If any commit is pushed after the latest workflow time, skip the branch.
		if (MatchedCommitTimeAddress === 0) {
			return {sha: '', length: 0}
		}

		// If the wokflow had not executed before, return SHA of the oldest commit.
		if (LatestWorkflowRunTime === 0) {
			return {sha: GitLog[GitLog.length - 1].hash, length: GitLog.length}
		}

		return {sha: GitLog[MatchedCommitTimeAddress].hash, length: GitLog.length}
	}
}

/**
 * @name GetChangedFilesFromSHAToBranchLatestCommits
 * @description Get changed files from a commit to the latest commit in a branch.
 * @param {Types.ProgramOptionsType} ProgramOptions The program options.
 * @param {stirng} CommitSHA The commit SHA.
 * @param {string} Branch The branch name.
 * @returns {Promise<string[]>} A list of changed files.
 */
export async function GetChangedFilesFromSHAToHead(ProgramOptions: Types.ProgramOptionsType, CommitSHA: string, Branch: string, DefaultBranch: string): Promise<string[]> {
	if (ProgramOptions.shouldUseApi) {
		const GitHubInstance = CreateGitHubInstance(ProgramOptions)
		const GitHubComparingRaw = await GitHubInstance.repos.compareCommits({
			owner: ProgramOptions.repo.split('/')[0],
			repo: ProgramOptions.repo.split('/')[1],
			head: Branch === 'latest' ? DefaultBranch : Branch,
			base: CommitSHA,
		}).then(Response => Response.data)
		return GitHubComparingRaw.files.map(File => File.filename)
	}

	if (!ProgramOptions.shouldUseApi) {
		const GitInstance = CreateGitInstance(ProgramOptions.ciWorkspacePath)
		const ChangedFiles = (await GitInstance.diff(['--name-only', `${CommitSHA}...${Branch === 'latest' ? DefaultBranch : Branch}`])).split('\n')
		return ChangedFiles[ChangedFiles.length - 1] === '' ? ChangedFiles.slice(0, ChangedFiles.length - 1) : ChangedFiles
	}
}

/**
 * @name GetChangedFilesFromACommit
 * @description Get changed files from a commit.
 * @param {Types.ProgramOptionsType} ProgramOptions The program options.
 * @param {stirng} CommitSHA The commit SHA.
 * @returns {Promise<string[]>} A list of changed files.
 */
export async function GetChangedFilesFromACommit(ProgramOptions: Types.ProgramOptionsType, CommitSHA: string, Branch: string, DefaultBranch: string): Promise<string[]> {
	if (ProgramOptions.shouldUseApi) {
		const GitHubInstance = CreateGitHubInstance(ProgramOptions)
		const GitHubComparingRaw = await GitHubInstance.repos.getCommit({
			owner: ProgramOptions.repo.split('/')[0],
			repo: ProgramOptions.repo.split('/')[1],
			ref: CommitSHA,
		}).then(Response => Response.data)
		return GitHubComparingRaw.files.map(File => `/gh/${File.filename}`)
	}

	if (!ProgramOptions.shouldUseApi) {
		const GitInstance = CreateGitInstance(ProgramOptions.ciWorkspacePath)
		const ChangedFiles = (await GitInstance.show(['--pretty=format:"%f"', '--name-only', CommitSHA])).split('\n')
		ChangedFiles.shift() // Remove the commit message.
		ChangedFiles.pop()
		return ChangedFiles
	}
}
