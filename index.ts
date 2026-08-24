import * as actions from '@actions/core'
import {availableParallelism, cpus} from 'node:os'
import {parseArgs} from 'node:util'
import {getLatestWorkflowTime} from './sources/actions.js'
import {listBranches} from './sources/branches.js'
import {getChangedFiles} from './sources/commits.js'
import {exportArgs, isDebug} from './sources/debug.js'
import {getIpAddress} from './sources/ipcheck.js'
import {PurgeRequestManager} from './sources/requests.js'
import type {programOptions} from './sources/types.js'

const cpuModel = cpus()[0]?.model ?? 'unknown CPU'
actions.info(`Running on ${cpuModel} with ${availableParallelism()} threads/vCPUs.`)

const {values} = parseArgs({options: {
	debug: {type: 'boolean', default: false},
	'gh-token': {type: 'string'},
	repo: {type: 'string'},
	'workflow-ref': {type: 'string'},
	branch: {type: 'string', default: ''},
	'ci-workspace-path': {type: 'string'},
}})
const ghToken = values['gh-token']
const workflowRef = values['workflow-ref']
const ciWorkspacePath = values['ci-workspace-path']
if (!ghToken || !values.repo || !workflowRef || !ciWorkspacePath) {
	throw new Error('Missing required --gh-token, --repo, --workflow-ref, or --ci-workspace-path option')
}

const options: programOptions = {debug: values.debug, ghToken, repo: values.repo, workflowRef, branch: values.branch, ciWorkspacePath}
if (isDebug(options)) {
	exportArgs(options)
}

actions.info(`The runner's IP address: ${await getIpAddress()}`)

performance.mark('latest-workflow-time')
const latestWorkflowTime = await getLatestWorkflowTime(options)
actions.info(`Getting the latest workflow run took ${Math.floor(performance.measure('latest-workflow-time-duration', 'latest-workflow-time').duration)} ms.`)

const branchSelection = await listBranches(options)
const changesByBranch = await Promise.all(branchSelection.branches.map(async branch => ({
	branch,
	filenames: await getChangedFiles(options, latestWorkflowTime, branch),
})))

performance.mark('purge')
const purgeRequest = new PurgeRequestManager(options)
purgeRequest.addUrls(changesByBranch.find(({branch}) => branch === branchSelection.defaultBranch)?.filenames ?? [], 'latest')
for (const {branch, filenames} of changesByBranch) {
	purgeRequest.addUrls(filenames, branch)
}

purgeRequest.start()
await purgeRequest.onEnded()
