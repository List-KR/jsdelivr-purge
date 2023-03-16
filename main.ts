import * as Actions from '@actions/core'
import * as GitHub from '@octokit/rest'
import * as Threads from 'worker_threads'

const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
const RepoName = process.env['GITHUB_REPO'].split('/')[1]
const RepoOwner = process.env['GITHUB_REPO'].split('/')[0]
const KnownBranches = await Octokit.rest.repos.listBranches({ owner: RepoOwner, repo: RepoName, page: Number.MAX_SAFE_INTEGER, per_page: 100 })
  .then(Result => Result.data.map(Data => Data.name ))
var Branches = Actions.getMultilineInput('branches', { required: true })
var BrancheThreads:Threads.Worker[] = []

// Check if an user selects all branches and selected branches are valid.
if (Branches.length === 1 && Branches[0] === '**') {
  Branches = KnownBranches
} else {
  Branches.forEach((element) => {
    if (KnownBranches.some(KnownBranche => KnownBranche !== element )) {
      Branches = Branches.filter(Branch => Branch !== element )
      Actions.warning(`The ${element} branch does not exist.`)
    }
  })
}

Actions.info(`The following branches will be processed:
${Branches.join('\n  - ').replace(/^/, ' - ')}
`)

Branches.forEach((Branche, Index) => {
  BrancheThreads.push(new Threads.Worker('./threads.js'))
  BrancheThreads[Index].postMessage({'Branche': Branche})
  BrancheThreads[Index].on('exit', () => {
    BrancheThreads = BrancheThreads.filter((element) => element === BrancheThreads[Index])
    if (!BrancheThreads.length) process.exit(0)
  })
})
