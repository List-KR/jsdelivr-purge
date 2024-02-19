import * as Actions from '@actions/core'
import * as Hashes from '@noble/hashes/sha3'
import * as HashesUtils from '@noble/hashes/utils'
import * as Git from 'simple-git'
import got from 'got'
import Os from 'node:os'
import type * as Types from './types.js'

async function GetFileFromGitHubRAW(ProgramOptions: Types.ProgramOptionsType, BranchOrTag: string, Filename: string): Promise<Uint8Array> {
	const Raw = await got(`https://github.com/${ProgramOptions.repo}/raw/${BranchOrTag}/${Filename}`, {
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
		},
		http2: true,
		headers: {
			'user-agent': 'jsdelivr-purge',
		},
	}).text()
	return new TextEncoder().encode(Raw)
}

function GetSHA3FromUint8Array(Uint8Data: Uint8Array): string {
	const HashUint8 = Hashes.sha3_256(Uint8Data)
	return HashesUtils.bytesToHex(HashUint8)
}

function CreateGitInstance(BasePath: string): Git.SimpleGit {
	const GitInstance = Git.simpleGit(BasePath, {maxConcurrentProcesses: Os.cpus().length})
	return GitInstance
}

async function ReadFileAsUint8Array(ProgramOptions: Types.ProgramOptionsType, BranchOrTag: string, Filename: string): Promise<Uint8Array> {
	const GitInstance = CreateGitInstance(ProgramOptions.ciWorkspacePath)
	return GitInstance.show([`${BranchOrTag}:${Filename}`]).then(Target => new TextEncoder().encode(Target))
}

export class GitHubRAWHash {
	private readonly GitHubRAWHashMap = new Map<string, string>()

	constructor(private readonly ProgramOptions: Types.ProgramOptionsType, private readonly ChangedFiles: Array<{Branch: string; Filename: string}>) {}

	async Register() {
		const PromiseList: Array<Promise<void>> = []
		for (const ChangedFile of this.ChangedFiles) {
			// eslint-disable-next-line no-async-promise-executor
			PromiseList.push(new Promise(async Resolve => {
				const Uint8Data = await ReadFileAsUint8Array(this.ProgramOptions, ChangedFile.Branch, ChangedFile.Filename)
				const SHA3 = GetSHA3FromUint8Array(Uint8Data)
				this.GitHubRAWHashMap.set(JSON.stringify({Branch: ChangedFile.Branch, Filename: ChangedFile.Filename}), SHA3)
				Resolve()
			}))
		}

		await Promise.all(PromiseList)
	}

	async Check() {
		if (this.GitHubRAWHashMap.size > 15) {
			Actions.warning('The number of changed files is over 15. It may take a long time to check the hash. Skipped.')
			return
		}

		const PromiseList: Array<Promise<void>> = []
		for (const ChangedFile of this.ChangedFiles) {
			// eslint-disable-next-line no-async-promise-executor
			PromiseList.push(new Promise(async Resolve => {
				for (var I = 0; I < Number.MAX_SAFE_INTEGER; I++) {
					// eslint-disable-next-line no-await-in-loop
					const Uint8Data = await GetFileFromGitHubRAW(this.ProgramOptions, ChangedFile.Branch, ChangedFile.Filename)
					if (GetSHA3FromUint8Array(Uint8Data) === this.GitHubRAWHashMap.get(JSON.stringify({Branch: ChangedFile.Branch, Filename: ChangedFile.Filename}))) {
						break
					}

					// eslint-disable-next-line no-await-in-loop
					await new Promise(Resolve => {
						setTimeout(Resolve, 500)
					})
				}

				Resolve()
			}))
		}

		await Promise.all(PromiseList)
	}
}
