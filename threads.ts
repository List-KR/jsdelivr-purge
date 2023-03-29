import * as Actions from '@actions/core'
import * as Got from 'got'
import * as GitHub from '@octokit/rest'
import * as Threads from 'worker_threads'
import * as Dotenv from 'dotenv'
import { DateTime } from 'luxon'
import * as CommitParse from './commit-parse.js'

Dotenv.config()

Threads.parentPort.on('message', async (Message: string) => {
  Actions.info(`Thread handling ${Message} started.`)

  // Variables 
  const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
  const [RepoOwner, RepoName] = process.env['GITHUB_REPO'].split('/')
  var ChangedFiles:string[] = []
  let LatestWorkflowRunTime:number = Number.MIN_SAFE_INTEGER
  
  // Check GitHub workflow history to calcuate duration of commits.
  await Octokit.rest.actions.listWorkflowRuns({
  owner: RepoOwner, repo: RepoName, workflow_id: process.env['GITHUB_WORKFLOW_REF'].match(new RegExp(`(?<=${process.env['GITHUB_REPO']}\/\.github\/workflows\/).+\.yml(?=@refs\/)`))[0],
  per_page: Number.MAX_SAFE_INTEGER }).then(async (ListWorkflowRuns) => {
    for (const Run of ListWorkflowRuns.data.workflow_runs) {
      if (Run.status === 'completed' && Run.conclusion === 'success' &&
      DateTime.fromFormat(Run.updated_at, "yyyy-MM-dd'T'HH:mm:ss'Z'").toMillis() > LatestWorkflowRunTime) {
        LatestWorkflowRunTime = DateTime.fromFormat(Run.updated_at, "yyyy-MM-dd'T'HH:mm:ss'Z'").toMillis()
      }
    }
  })

  // Calcuate time including the delay.
  if (LatestWorkflowRunTime === Number.MIN_SAFE_INTEGER) {
    LatestWorkflowRunTime = Date.now()
    Actions.info(`This workflow run is first jsdelivr-purge run of ${process.env['GITHUB_REPO']}.`)
  }

  const DateTimeDelay = DateTime.fromFormat(process.env['INPUT_DELAY'], 'H:m:s')
  const CommitTime:DateTime = DateTime.fromMillis(LatestWorkflowRunTime).minus({
    hours: DateTimeDelay.hour,
    minutes: DateTimeDelay.minute,
    seconds: DateTimeDelay.second
  })

  // Get a list of changed files during the duration.
  await Octokit.rest.repos.listCommits({
  owner: RepoOwner, repo: RepoName, per_page: Number.MAX_SAFE_INTEGER,
  since: CommitTime.toISO()}).then(async (ListCommits) => {
    for (const Commit of ListCommits.data) {
      await Octokit.rest.git.getTree({ owner: RepoOwner, repo: RepoName, tree_sha: Commit.commit.tree.sha }).then(async (CommitData) => {
        ChangedFiles = ChangedFiles.concat((await CommitParse.Parse(CommitData.data.tree, null, Message)).filter((CommitChangedFile) => {
          return !(ChangedFiles.some((ChangedFile) => { return ChangedFile === CommitChangedFile })) || !ChangedFiles.length
        }))
      })
    }
  })
  
  if (!ChangedFiles.length) {
    Actions.info(`Thread for ${Message}: No files changes found. Exiting...`)
    Threads.parentPort.close()
    process.exit(0)
  }
  
  Actions.info(`Thread for ${Message}: Found files changes during from ${CommitTime.toISO()}:
  ${ChangedFiles.join('\n  - ').replace(/^/, ' - ')}
  `)
  
  // Make requests
  for (const Changed of ChangedFiles) {
    const CDNResponses:Array<string> = []
    while(CDNResponses.length === 0 || !CDNResponses.some(async (CDNResponse) => {
      const CDNStatus:JSON = await Got.got.get(`https://purge.jsdelivr.net/status/${CDNResponse}`).json()
      return CDNStatus['status'] === 'finished' || CDNStatus['status'] === 'failed'
    })) {
      const CDNRequest:JSON = await Got.got.post('https://purge.jsdelivr.net/', {
        headers: { 'cache-control': 'no-cache' },
        json: {
          'path': [`/gh/${RepoOwner}/${RepoName}@${Message}/${Changed}`]
        }}).json()
      Actions.info(`Thread for ${Message}: Sent new request having ${CDNRequest['id']} ID.`)
      CDNResponses.push(CDNRequest['id'])
    }
    Actions.info(`Thread for ${Message}: Purged ${Changed}.`)
  }
  Actions.info(`Thread for ${Message}: All changed files are purged. Exiting...`)
  Threads.parentPort.close()
  process.exit(0)
})
