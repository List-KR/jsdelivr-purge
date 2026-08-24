import {chunk} from 'es-toolkit'
import type {remainingFilename} from './types.js'

export function groupRequestsByNumberWithBranch(remainingFilenames: remainingFilename[], count: number): remainingFilename[][] {
	if (remainingFilenames.length === 0) {
		return []
	}

	if (remainingFilenames.every(({branchOrTag}) => branchOrTag === remainingFilenames[0]?.branchOrTag)) {
		return chunk(remainingFilenames, count)
	}

	return [
		...chunk(remainingFilenames.filter(({branchOrTag}) => branchOrTag === 'latest'), count),
		...chunk(remainingFilenames.filter(({branchOrTag}) => branchOrTag !== 'latest'), count),
	]
}
