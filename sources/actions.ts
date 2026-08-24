import {Octokit} from '@octokit/rest'
import type {programOptions} from './types.js'

export function getWorkflowId(workflowRef: string): string {
	const workflowId = /^[^/]+\/[^/]+\/\.github\/workflows\/([^/@]+\.ya?ml)@.+$/.exec(workflowRef)?.[1]
	if (!workflowId) {
		throw new Error(`Invalid GitHub workflow ref: ${workflowRef}`)
	}

	return workflowId
}

async function listWorkflowRuns(options: programOptions, eventType: string) {
	const octokit = new Octokit({auth: options.ghToken})
	const [repoOwner, repoName, extra] = options.repo.split('/')
	if (!repoOwner || !repoName || extra) {
		throw new Error(`Invalid GitHub repository: ${options.repo}`)
	}

	return octokit.actions.listWorkflowRuns({
		event: eventType,
		owner: repoOwner,
		repo: repoName,
		workflow_id: getWorkflowId(options.workflowRef),
		per_page: 100,
	}).then(({data}) => data.workflow_runs)
}

export async function getLatestWorkflowTime(options: programOptions): Promise<number> {
	const events = ['push', 'release', 'workflow_dispatch', 'schedule']
	const workflowRuns = (await Promise.all(events.map(eventType => listWorkflowRuns(options, eventType)))).flat()

	return workflowRuns.reduce((latestTime, workflowRun) => {
		if (workflowRun.status !== 'completed' || workflowRun.conclusion !== 'success') {
			return latestTime
		}

		const updatedTime = Date.parse(workflowRun.updated_at)
		return Number.isNaN(updatedTime) ? latestTime : Math.max(latestTime, updatedTime)
	}, 0)
}
