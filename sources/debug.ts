import * as actions from '@actions/core'
import type {programOptions} from './types.js'

export function isDebug(options: programOptions): boolean {
	return actions.isDebug() || options.debug
}

export function exportArgs(options: programOptions): void {
	actions.debug(`programOptions: ${JSON.stringify({...options, ghToken: '***'})}`)
}
