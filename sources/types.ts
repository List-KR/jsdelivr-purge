/* eslint-disable @typescript-eslint/naming-convention */
export type ProgramOptionsRawType = {
	debug: boolean;
	ghToken: string;
	repo: string;
	workflowRef: string;
	branch: string;
	ciWorkspacePath: string;
	ciActionPath: string;
}

export type ProgramOptionsType = {
	debug: boolean;
	ghToken: string;
	repo: string;
	workflowRef: string;
	branch: string;
	ciWorkspacePath: string;
	ciActionPath: string;
}

export type CDNStatusResponseType = {
	id: string;
	status: 'pending' | 'finished' | 'failed';
	paths: Record<string, {
		throttled: boolean;
		providers: {
			CF: boolean;
			FY: boolean;
		};
	}>;
}

export type CDNPostResponseType = {
	id: string;
	status: 'pending' | 'finished' | 'failed';
	timestamp: string;
}

export type CDNPostRequestType = {
	path: string[];
}

export type RemainingFilenamesArrayType = {
	Filename: string;
	BranchOrTag: string;
}

export type CommitSHA = {
	sha: string;
	length: number;
}
