import * as Actions from '@actions/core'
import * as GitHub from '@octokit/rest'
import * as Threads from 'worker_threads'
import * as Dotenv from 'dotenv'
const DateTime = require('date-and-time')

Dotenv.config()
const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
const RepoName = process.env['GITHUB_REPO'].split('/')[1]
const RepoOwner = process.env['GITHUB_REPO'].split('/')[0]
const KnownBranches = await Octokit.rest.repos.listBranches({ owner: RepoOwner, repo: RepoName, page: Number.MAX_SAFE_INTEGER, per_page: 100 })
  .then(Result => Result.data.map(Data => Data.name ))
var Branches = Actions.getMultilineInput('branches')
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

// Check delay input
if (DateTime.isValid(Actions.getInput('delay'), 'H:m:s')) {
  const Delay = DateTime.preparse(Actions.getInput('delay'), 'H:m:s')
  if (Delay['H'] > 12 || (Delay['H'] === 12 && (Delay['m'] > 0 || Delay['s'] > 0))) {
    Actions.setFailed('The delay input must be 12 hours or shorter.')
  } else if (Delay['H'] === 0 && ((Delay['m'] === 30 && Delay['s'] > 0) || Delay['m'] < 30)) {
    Actions.setFailed('The delay input must be 30 minutes or longer.')
  }
} else {
  Actions.setFailed(`The delay input is invalid format:
  ${Actions.getInput('delay')}

  The valid format is H:m:s. If you want to learn more, please visit the following URL:
  https://github.com/knowledgecode/date-and-time#parsedatestring-arg-utc
  `)
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
