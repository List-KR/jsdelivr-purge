import * as GitHub from '@octokit/rest'
import {DateTime} from 'luxon'
import type {ProgramOptionsType} from './types.js'

async function ListWorkflowRuns(ProgramOptions: ProgramOptionsType, EventType: string) {
	const GitHubInstance = new GitHub.Octokit({auth: ProgramOptions.ghToken})
	const [RepoOwner, RepoName] = ProgramOptions.repo.split('/')
	const WorkflowRuns = await GitHubInstance.actions.listWorkflowRuns({
		event: EventType,
		owner: RepoOwner, repo: RepoName,
		workflow_id: /(?<=^[A-Za-z0-9-_.]+\/[A-Za-z0-9-_.]+\/\.github\/workflows\/).+\.yml(?=@refs\/)/.exec(ProgramOptions.workflowRef)[0],
	}).then(WorkflowRuns => WorkflowRuns.data.workflow_runs)
	return WorkflowRuns
}

/**
 * @name GetLatestWorkflowTime
 * @description Get the latest workflow time.
 * @param {ProgramOptionsType} ProgramOptions The program options.
 * @returns {Promise<number>} The latest workflow time in milliseconds.
 */
export async function GetLatestWorkflowTime(ProgramOptions: ProgramOptionsType): Promise<number> {
	var LatestWorkflowRunTime = 0
	let WorkflowRuns: ReturnType<typeof ListWorkflowRuns> = null
	for (const EventType of ['push', 'release']) {
		if (WorkflowRuns === null) {
			WorkflowRuns = ListWorkflowRuns(ProgramOptions, EventType)
		} else {
			// eslint-disable-next-line no-await-in-loop
			(await WorkflowRuns).push(...await ListWorkflowRuns(ProgramOptions, EventType))
		}
	}

	for (const WorkflowRun of await WorkflowRuns) {
		if (WorkflowRun.status === 'completed' && WorkflowRun.conclusion === 'success'
		&& DateTime.fromISO(WorkflowRun.updated_at).toMillis() > LatestWorkflowRunTime) {
			LatestWorkflowRunTime = DateTime.fromISO(WorkflowRun.updated_at).toMillis()
		}
	}

	return LatestWorkflowRunTime
}
