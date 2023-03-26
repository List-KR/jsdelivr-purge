import * as GitHub from '@octokit/rest'
import * as Dotenv from 'dotenv'

Dotenv.config()
const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
const [RepoOwner, RepoName] = process.env['GITHUB_REPO'].split('/')

interface CommitData {
	path?: string
	mode?: string
	type?: string
	sha?: string
	size?: Number
	url?: string
}

export async function Parse(CommitData:CommitData[], DirectoryPrefix:string) {
	var ChangedFiles:string[] = []
	for (const Tree of CommitData) {
		if (Tree.type === 'blob') ChangedFiles.push(`${DirectoryPrefix ?? ''}${Tree.path}`)
		if (Tree.type === 'tree') {
			ChangedFiles = ChangedFiles.concat(await Parse(await Octokit.rest.git.getTree(
				{ owner: RepoOwner, repo: RepoOwner, tree_sha: Tree.sha }).then((Data) => { return Data.data.tree }), `${DirectoryPrefix ?? ''}${Tree.path}/`))	
		}
	}
	return ChangedFiles
}