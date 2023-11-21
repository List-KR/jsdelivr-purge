import * as GitHub from '@octokit/rest'
import * as Actions from '@actions/core'
import * as Commander from 'commander'
import checkDiskSpace from 'check-disk-space'

const Program = new Commander.Command()

Program.option('--debug', 'output extra debugging', false)
	.option('--gh-token <TOKEN>', 'GitHub token', '')
	.option('--repo <REPO>', 'A GitHub repository. eg: owner/repo', '')
	.option('--ci-workspace-path <PATH>', 'A path to the CI workspace.', '')

Program.parse()

type ProgramOptionsType = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	debug: boolean;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ghToken: string;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	repo: string;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ciWorkspacePath: string;
}
const ProgramOptions: ProgramOptionsType = Program.opts()

const GitHubInstance = new GitHub.Octokit({auth: ProgramOptions.ghToken})
const RepoSize = GitHubInstance.repos.get({owner: ProgramOptions.repo.split('/')[0], repo: ProgramOptions.repo.split('/')[1]})
	.then(Response => Response.data.size)
const DiskFreeSize = checkDiskSpace(ProgramOptions.ciWorkspacePath).then(DiskInfo => DiskInfo.free)

await Promise.all([RepoSize, DiskFreeSize]).then(([RepoSizeVaule, DiskFreeSizeVaule]) => {
	Actions.info(`calc-repo-size: RepoSize: ${RepoSizeVaule}; DiskFreeSize: ${DiskFreeSizeVaule}`)
	if (RepoSizeVaule * 1000 < DiskFreeSizeVaule) {
		Actions.setOutput('should_use_api', 'false')
	} else {
		Actions.setOutput('should_use_api', 'true')
	}
})
