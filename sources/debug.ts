import * as Actions from '@actions/core'
import type * as Types from './types.js'

export function IsDebug(Args: Types.ProgramOptionsType | Types.ProgramOptionsRawType) {
	const ArgsDebug = typeof Args.debug === 'string' ? Args.debug === 'true' : Args.debug
	return Actions.isDebug() || ArgsDebug
}

export function ExportArgs(Args: Types.ProgramOptionsType | Types.ProgramOptionsRawType) {
	Actions.debug(`ProgramOptions: ${JSON.stringify(Args).replace(/(?<=,"ghToken":")[^"]+/, '***')}`)
}
