import * as Actions from '@actions/core'
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

async function Inspect(CommitData:CommitData[], DirectoryPrefix:string, Branch:string) {
  var ChangedFiles:CommitData[] = []
  for (const Tree of CommitData) {
    Actions.info(`Thread for ${Branch}: Looking up with ${Tree.sha}: ${DirectoryPrefix}${Tree.path}`)
    if (Tree.type === 'blob') ChangedFiles.push({path: `${DirectoryPrefix}${Tree.path}`, mode: 'blob'})
    if (Tree.type === 'tree') {
      ChangedFiles = ChangedFiles.concat(await Inspect(await Octokit.rest.git.getTree(
        { owner: RepoOwner, repo: RepoName, tree_sha: Tree.sha }).then((Data) => { return Data.data.tree }), `${DirectoryPrefix}${Tree.path}/`, Branch))
    }
  }
  return ChangedFiles
}

export async function Parse(CommitData:CommitData[], Branch:string) {
  return (await Inspect(CommitData, '', Branch)).filter(Commit => Commit.mode === 'blob').map(Commit => Commit.path)
}