export type programOptions = {
	debug: boolean
	ghToken: string
	repo: string
	workflowRef: string
	branch: string
	ciWorkspacePath: string
}

export type branchSelection = {
	branches: string[]
	defaultBranch: string
}

export type cdnStatusResponse = {
	id: string
	status: 'pending' | 'finished' | 'failed'
	paths: Record<string, {
		throttled: boolean
		providers: Record<string, boolean>
	}>
}

export type cdnPostResponse = {
	id: string
	status: 'pending' | 'finished' | 'failed'
	timestamp: string
}

export type cdnPostRequest = {
	path: string[]
}

export type remainingFilename = {
	filename: string
	branchOrTag: string
}
