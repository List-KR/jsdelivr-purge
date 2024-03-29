import * as GitHub from '@octokit/rest'
import {DateTime} from 'luxon'
import type {ProgramOptionsType} from './types.js'

/**
 * @name GetLatestWorkflowTime
 * @description Get the latest workflow time.
 * @param {ProgramOptionsType} ProgramOptions The program options.
 * @returns {Promise<number>} The latest workflow time in milliseconds.
 */
export async function GetLatestWorkflowTime(ProgramOptions: ProgramOptionsType): Promise<number> {
	const GitHubInstance = new GitHub.Octokit({auth: ProgramOptions.ghToken})
	const [RepoOwner, RepoName] = ProgramOptions.repo.split('/')
	var LatestWorkflowRunTime = 0
	const WorkflowRuns = await GitHubInstance.actions.listWorkflowRuns({
		owner: RepoOwner, repo: RepoName,
		workflow_id: /(?<=^[A-Za-z0-9-_.]+\/[A-Za-z0-9-_.]+\/\.github\/workflows\/).+\.yml(?=@refs\/)/.exec(ProgramOptions.workflowRef)[0],
	}).then(WorkflowRuns => WorkflowRuns.data.workflow_runs)
	for (const WorkflowRun of WorkflowRuns) {
		if (WorkflowRun.status === 'completed' && WorkflowRun.conclusion === 'success'
		&& DateTime.fromISO(WorkflowRun.updated_at).toMillis() > LatestWorkflowRunTime) {
			LatestWorkflowRunTime = DateTime.fromISO(WorkflowRun.updated_at).toMillis()
		}
	}

	return LatestWorkflowRunTime
}
