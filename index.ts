import * as Commander from 'commander'
import type * as Types from './sources/types'
import {ExportArgs, IsDebug} from './sources/debug'
import {ReplaceStringWithBooleanInObject} from './sources/utility'
import {GetLatestWorkflowTime} from './sources/actions'
import {ListBranches} from './sources/branches'
import {GetChangedFilesFromSHAToHead, GetCommitSHAFromLatestWorkflowTime} from './sources/commits'
import {PurgeRequestManager} from './sources/requests'

const Program = new Commander.Command()

// Set options.
Program.option('--debug', 'output extra debugging', false)
	.option('--gh-token <TOKEN>', 'GitHub token', '')
	.option('--repo <REPO>', 'A GitHub repository. eg: owner/repo', '')
	.option('--workflow-ref <WORKFLOW_REF>', 'A GitHub workflow ref. eg: refs/heads/master', '')
	.option('--branch <BRANCH>', 'A GitHub branch. eg: master', '')
	.option('--ci-workspace-path <PATH>', 'A path to the CI workspace.', '')
	.option('--ci-action-path <PATH>', 'A path to the CI action.', '')
	.option('--should-use-api <TRUE_OR_FALSE>', 'Should use GitHub API?', 'false')

// Initialize Input of the options and export them.
Program.parse()

// Declare the options and print them if the debugging mode is enabled.
const ProgramRawOptions: Types.ProgramOptionsRawType = Program.opts()
if (IsDebug(ProgramRawOptions)) {
	ExportArgs(ProgramRawOptions)
}

// Redefine with boolean.
const ProgramOptions = ReplaceStringWithBooleanInObject(ProgramRawOptions) as Types.ProgramOptionsType

// Workflow
const LatestWorkflowRunTime = await GetLatestWorkflowTime(ProgramOptions).then(LatestWorkflowRunTime => LatestWorkflowRunTime)
const Branches = await ListBranches(ProgramOptions).then(Branches => Branches)
const PurgeRequest = new PurgeRequestManager(ProgramOptions)
for (const Branch of Branches) {
	// eslint-disable-next-line no-await-in-loop
	const CommitSHA = await GetCommitSHAFromLatestWorkflowTime(ProgramOptions, LatestWorkflowRunTime, Branch).then(CommitSHA => CommitSHA)
	if (CommitSHA === null) {
		continue
	}

	// eslint-disable-next-line no-await-in-loop
	const ChangedFiles = await GetChangedFilesFromSHAToHead(ProgramOptions, CommitSHA, Branch, Branches[1]).then(ChangedFiles => ChangedFiles)
	PurgeRequest.AddURLs(ChangedFiles, Branch)
}

PurgeRequest.Start()
