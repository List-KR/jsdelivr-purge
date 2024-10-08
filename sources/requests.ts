import got from 'got'
import * as Actions from '@actions/core'
import * as Os from 'node:os'
import PQueue from 'p-queue'
import {IsDebug} from './debug.js'
import * as Utility from './utility.js'
import type * as Types from './types.js'

async function GetCDNResponse(ProgramOptions: Types.ProgramOptionsType, ID: string): Promise<Types.CDNStatusResponseType> {
	const ResponseRaw: Types.CDNStatusResponseType = await got(`https://purge.jsdelivr.net/status/${ID}`, {
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
		},
		http2: true,
		headers: {
			'user-agent': 'jsdelivr-purge'
		}
	}).json()

	for (const [Key, Value] of Object.entries(ResponseRaw.paths)) {
		if (Value.throttled) {
			Actions.warning(`Throttled: ${Key.replace(/^\/gh\/[A-Za-z0-9-._]+\/[A-Za-z0-9-._]+(?=@)/, '')}`)
		}
	}

	Actions.startGroup(`GetCDNResponse called: ${ID}`)
	Actions.info(JSON.stringify(ResponseRaw))
	Actions.endGroup()
	return ResponseRaw
}

async function PostPurgeRequest(ProgramOptions: Types.ProgramOptionsType, BranchOrTag: string[], Filenames: string[]): Promise<Types.CDNPostResponseType> {
	const ResponseRaw: Types.CDNPostResponseType = await got.post('https://purge.jsdelivr.net/', {
		headers: {
			'cache-control': 'no-cache',
			'user-agent': 'jsdelivr-purge'
		},
		json: {
			path: new Array(Filenames.length).fill(null, 0, Filenames.length).map((Filename, Index) => `/gh/${ProgramOptions.repo}@${BranchOrTag[Index]}/${Filenames[Index]}`)
		} satisfies Types.CDNPostRequestType,
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
		},
		http2: true
	}).json()
	Actions.startGroup(`PostPurgeRequest called: ${ResponseRaw.id}`)
	Actions.info(JSON.stringify(ResponseRaw))
	Actions.endGroup()
	return ResponseRaw
}

export class PurgeRequestManager {
	private readonly SharedPQueue = new PQueue({autoStart: true, concurrency: Os.cpus().length})
	private readonly RemainingFilenames: Types.RemainingFilenamesArrayType[] = []

	constructor(private readonly ProgramOptions: Types.ProgramOptionsType) {}

	AddURLs(Filenames: string[], BranchOrTag: string) {
		const SplittedFilenames = Utility.GroupRequestsByNumberWithBranch(Filenames.map(Filename => ({Filename, BranchOrTag})), 20)

		if (IsDebug(this.ProgramOptions)) {
			Actions.debug(`SplittedFilenames variable in requests.ts: ${JSON.stringify(SplittedFilenames)}`)
			Actions.debug(`Filenames variable in requests.ts: ${JSON.stringify(Filenames)}`)
			Actions.debug(`BranchOrTag variable in requests.ts: ${BranchOrTag}`)
		}

		if (SplittedFilenames[SplittedFilenames.length - 1].length < 20) {
			this.RemainingFilenames.push(...SplittedFilenames.pop())
		}

		for (const SplittedFilenameGroup of SplittedFilenames) {
			void this.SharedPQueue.add(async () => {
				const CDNRequestArary: Types.CDNPostResponseType[] = []
				while (CDNRequestArary.length === 0 || !CDNRequestArary.some(async CDNResponse => (await GetCDNResponse(this.ProgramOptions, CDNResponse.id)).status === 'finished'
					|| (await GetCDNResponse(this.ProgramOptions, CDNResponse.id)).status === 'failed')) {
					// eslint-disable-next-line no-await-in-loop
					const CDNRequest: Types.CDNPostResponseType = await PostPurgeRequest(this.ProgramOptions, new Array(20).fill(BranchOrTag, 0, 20) as string[], SplittedFilenameGroup.map(SplittedFilename => SplittedFilename.Filename))
					CDNRequestArary.push(CDNRequest)
					// eslint-disable-next-line no-await-in-loop
					await new Promise(Resolve => {
						setTimeout(Resolve, 2500)
					})
				}

				Actions.info(`Queue: jsDelivr server returns that the following files are purged:
				${SplittedFilenameGroup.map(Filename => `@${Filename.BranchOrTag}/${Filename.Filename}`).map(Item => `- ${Item}`).join('\n')}
				`)
			})
		}
	}

	Start(): void {
		const RemainingFilenamesGroup = Utility.GroupRequestsByNumberWithBranch(this.RemainingFilenames, 20)
		for (const RemainingFilenames of RemainingFilenamesGroup) {
			void this.SharedPQueue.add(async () => {
				const CDNRequestArary: Types.CDNPostResponseType[] = []
				while (CDNRequestArary.length === 0 || !CDNRequestArary.some(async CDNResponse => (await GetCDNResponse(this.ProgramOptions, CDNResponse.id)).status === 'finished'
					|| (await GetCDNResponse(this.ProgramOptions, CDNResponse.id)).status === 'failed')) {
					// eslint-disable-next-line no-await-in-loop
					const CDNRequest: Types.CDNPostResponseType = await PostPurgeRequest(this.ProgramOptions, RemainingFilenames.map(RemainingFilename => RemainingFilename.BranchOrTag), RemainingFilenames.map(RemainingFilename => RemainingFilename.Filename))
					CDNRequestArary.push(CDNRequest)
					// eslint-disable-next-line no-await-in-loop
					await new Promise(Resolve => {
						setTimeout(Resolve, 2500)
					})
				}

				Actions.info('Queue: jsDelivr server returns that the following files are purged:')
				Actions.info(`${RemainingFilenames.map(Filename => `@${Filename.BranchOrTag}/${Filename.Filename}`).map(Item => `- ${Item}`).join('\n')}`)
			})
		}

		this.SharedPQueue.start()
	}

	OnEnded(): void {
		this.SharedPQueue.on('idle', () => {
			Actions.info(`Purging took ${Math.floor(performance.measure('purge-duration', 'purge').duration)} ms.`)
		})
	}
}
