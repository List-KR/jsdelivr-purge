import * as Commander from 'commander'
import type * as Types from './sources/types.js'
import {ExportArgs, IsDebug} from './sources/debug.js'
import {ReplaceStringWithBooleanInObject} from './sources/utility.js'
import {GetLatestWorkflowTime} from './sources/actions.js'
import {ListBranches} from './sources/branches.js'
import {CommitManager} from './sources/commits.js'
import {PurgeRequestManager} from './sources/requests.js'
import {GetIPAddress} from './sources/ipcheck.js'
import {GitHubRAWHash} from './sources/hash.js'
import * as Actions from '@actions/core'
import * as Os from 'node:os'

Actions.info(`Running on ${Os.cpus()[0].model} with ${Os.cpus().length} threads/vCPUs.`)

const Program = new Commander.Command()

// Set options.
Program.option('--debug', 'output extra debugging', false)
	.option('--gh-token <TOKEN>', 'GitHub token', '')
	.option('--repo <REPO>', 'A GitHub repository. eg: owner/repo', '')
	.option('--workflow-ref <WORKFLOW_REF>', 'A GitHub workflow ref. eg: refs/heads/master', '')
	.option('--branch <BRANCH>', 'A GitHub branch. eg: master', '')
	.option('--ci-workspace-path <PATH>', 'A path to the CI workspace.', '')
	.option('--ci-action-path <PATH>', 'A path to the CI action.', '')

// Initialize Input of the options and export them.
Program.parse()

// Declare the options and print them if the debugging mode is enabled.
const ProgramRawOptions: Types.ProgramOptionsRawType = Program.opts()
if (IsDebug(ProgramRawOptions)) {
	ExportArgs(ProgramRawOptions)
}

// Redefine with boolean.
const ProgramOptions = ReplaceStringWithBooleanInObject(ProgramRawOptions) as Types.ProgramOptionsType

// Print the runner's IP address.
Actions.info(`The runner's IP address: ${await GetIPAddress().then(IPAddress => IPAddress)}`)

// Get the latest workflow run time.
performance.mark('latestworkflowtime')
const LatestWorkflowRunTime = await GetLatestWorkflowTime(ProgramOptions).then(LatestWorkflowRunTime => LatestWorkflowRunTime)
Actions.info(`Getting the latest workflow run took ${Math.floor(performance.measure('latestworkflowtime-duration', 'latestworkflowtime').duration)} ms.`)

// List branches.
const Branches = await ListBranches(ProgramOptions).then(Branches => Branches)

// Get changed files.
var ChangedFiles: Array<{Branch: string; Filename: string}> = []
for (const Branch of Branches) {
	const CommitManagerInstance = new CommitManager(ProgramOptions, Branches)
	// eslint-disable-next-line no-await-in-loop
	const CommitSHA = await CommitManagerInstance.GetCommitSHAFromLatestWorkflowTime(LatestWorkflowRunTime, Branch).then(CommitSHA => CommitSHA)
	if (CommitSHA.length === 0) {
		continue
	}

	if (CommitSHA.length === 1) {
		// eslint-disable-next-line no-await-in-loop
		ChangedFiles.push(...(await CommitManagerInstance.GetChangedFilesFromACommit(CommitSHA.sha).then(ChangedFiles => ChangedFiles)).map(ChangedFile => ({Branch, Filename: ChangedFile})))
	} else {
		// eslint-disable-next-line no-await-in-loop
		ChangedFiles.push(...(await CommitManagerInstance.GetChangedFilesFromSHAToHead(CommitSHA.sha, Branch).then(ChangedFiles => ChangedFiles)).map(ChangedFile => ({Branch, Filename: ChangedFile})))
	}
}

// Hold until checking hash is done.
performance.mark('githubrawhash')
const GitHubRAWHashInstance = new GitHubRAWHash(ProgramOptions, ChangedFiles)
await GitHubRAWHashInstance.Register()
await GitHubRAWHashInstance.Check()
Actions.info(`Checking hashes took ${Math.floor(performance.measure('githubrawhash-duration', 'githubrawhash').duration)} ms.`)

performance.mark('purge')
const PurgeRequest = new PurgeRequestManager(ProgramOptions)
PurgeRequest.AddURLs(ChangedFiles.filter(ChangedFile => ChangedFile.Branch === 'latest').map(ChangedFile => ChangedFile.Filename), 'latest')
for (const Branch of Branches.filter(Branch => Branch !== 'latest')) {
	PurgeRequest.AddURLs(ChangedFiles.filter(ChangedFile => ChangedFile.Branch === Branch).map(ChangedFile => ChangedFile.Filename), Branch)
}

PurgeRequest.Start()
PurgeRequest.OnEnded()
