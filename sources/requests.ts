import * as actions from '@actions/core'
import got from 'got'
import {availableParallelism} from 'node:os'
import {setTimeout as delay} from 'node:timers/promises'
import PQueue from 'p-queue'
import {isDebug} from './debug.js'
import type {cdnPostRequest, cdnPostResponse, cdnStatusResponse, programOptions, remainingFilename} from './types.js'
import {groupRequestsByNumberWithBranch} from './utility.js'

const requestLimit = 20

async function getCdnResponse(id: string): Promise<cdnStatusResponse> {
	const response = await got(`https://purge.jsdelivr.net/status/${id}`, {
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
		},
		http2: true,
		headers: {
			'user-agent': 'jsdelivr-purge',
		},
	}).json<cdnStatusResponse>()

	for (const [path, status] of Object.entries(response.paths)) {
		if (status.throttled) {
			actions.warning(`Throttled: ${path.replace(/^\/gh\/[A-Za-z0-9-._]+\/[A-Za-z0-9-._]+(?=@)/, '')}`)
		}
	}

	actions.startGroup(`getCdnResponse called: ${id}`)
	actions.info(JSON.stringify(response))
	actions.endGroup()
	return response
}

async function postPurgeRequest(options: programOptions, files: remainingFilename[]): Promise<cdnPostResponse> {
	const response = await got.post('https://purge.jsdelivr.net/', {
		headers: {
			'cache-control': 'no-cache',
			'user-agent': 'jsdelivr-purge',
		},
		json: {
			path: files.map(({branchOrTag, filename}) => `/gh/${options.repo}@${branchOrTag}/${filename}`),
		} satisfies cdnPostRequest,
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
		},
		http2: true,
	}).json<cdnPostResponse>()

	actions.startGroup(`postPurgeRequest called: ${response.id}`)
	actions.info(JSON.stringify(response))
	actions.endGroup()
	return response
}

async function purgeFiles(options: programOptions, files: remainingFilename[]): Promise<void> {
	let response: cdnPostResponse | cdnStatusResponse = await postPurgeRequest(options, files)
	while (response.status === 'pending') {
		await delay(2500)
		response = await getCdnResponse(response.id)
	}

	if (response.status === 'failed') {
		throw new Error(`jsDelivr purge failed: ${response.id}`)
	}

	actions.info(`Queue: jsDelivr server reports that the following files are purged:\n${files.map(({branchOrTag, filename}) => `- @${branchOrTag}/${filename}`).join('\n')}`)
}

export class PurgeRequestManager {
	private readonly queue = new PQueue({concurrency: availableParallelism()})
	private readonly remainingFilenames: remainingFilename[] = []
	private readonly tasks: Array<Promise<unknown>> = []

	constructor(private readonly options: programOptions) {}

	private enqueue(files: remainingFilename[]): void {
		this.tasks.push(this.queue.add(() => purgeFiles(this.options, files)))
	}

	addUrls(filenames: string[], branchOrTag: string): void {
		const groups = groupRequestsByNumberWithBranch(filenames.map(filename => ({filename, branchOrTag})), requestLimit)
		const lastGroup = groups.at(-1)

		if (lastGroup && lastGroup.length < requestLimit) {
			this.remainingFilenames.push(...(groups.pop() ?? []))
		}

		for (const group of groups) {
			this.enqueue(group)
		}

		if (isDebug(this.options)) {
			actions.debug(`groups variable in requests.ts: ${JSON.stringify(groups)}`)
			actions.debug(`filenames variable in requests.ts: ${JSON.stringify(filenames)}`)
			actions.debug(`branchOrTag variable in requests.ts: ${branchOrTag}`)
		}
	}

	start(): void {
		for (const group of groupRequestsByNumberWithBranch(this.remainingFilenames, requestLimit)) {
			this.enqueue(group)
		}
	}

	async onEnded(): Promise<void> {
		await Promise.all(this.tasks)
		actions.info(`Purging took ${Math.floor(performance.measure('purge-duration', 'purge').duration)} ms.`)
	}
}
