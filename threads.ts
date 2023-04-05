import * as Actions from '@actions/core'
import * as Got from 'got'
import * as GitHub from '@octokit/rest'
import * as Threads from 'worker_threads'
import * as Dotenv from 'dotenv'
import { DateTime } from 'luxon'

Dotenv.config()

Threads.parentPort.on('message', async (Message: string) => {
  Actions.info(`Thread handling ${Message} started.`)

  // Variables 
  const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
  const [RepoOwner, RepoName] = process.env['GITHUB_REPO'].split('/')
  var ChangedFiles:string[] = []
  let LatestWorkflowRunTime:number = Number.MIN_SAFE_INTEGER
  let OldestCommitTimeAddr:number = 0
  
  // Check GitHub workflow history to calcuate duration of commits.
  await Octokit.rest.actions.listWorkflowRuns({
  owner: RepoOwner, repo: RepoName, workflow_id: process.env['GITHUB_WORKFLOW_REF'].match(new RegExp(`(?<=${process.env['GITHUB_REPO']}\/\.github\/workflows\/).+\.yml(?=@refs\/)`))[0],
  per_page: Number.MAX_SAFE_INTEGER }).then(async (ListWorkflowRuns) => {
    for (const Run of ListWorkflowRuns.data.workflow_runs) {
      if (Run.status === 'completed' && Run.conclusion === 'success' &&
      DateTime.fromISO(Run.updated_at).toMillis() > LatestWorkflowRunTime) {
        LatestWorkflowRunTime = DateTime.fromISO(Run.updated_at).toMillis()
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
  await Octokit.rest.repos.listCommits({ owner: RepoOwner, repo: RepoName, since: CommitTime.toISO(), until: DateTime.fromMillis(Date.now()).toISO(), per_page: Number.MAX_SAFE_INTEGER })
    .then(async (ListCommitsData) => {
      for (let i = 0; i < ListCommitsData.data.length; i++) {
        if (DateTime.fromISO(ListCommitsData.data[i].commit.author.date).toMillis() < DateTime.fromISO(ListCommitsData.data[OldestCommitTimeAddr].commit.author.date).toMillis()) {
          OldestCommitTimeAddr = i
        }
      }
      await Octokit.rest.repos.compareCommits({ owner: RepoOwner, repo: RepoName, head: `${RepoOwner}:${Message}`, base: `${RepoOwner}:${ListCommitsData.data[OldestCommitTimeAddr].sha}` })
      .then(CompareData => ChangedFiles = CompareData.data.files.map(Files => Files.filename))
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
  await new Promise(resolve => setTimeout(resolve, 1000))
  Threads.parentPort.close()
  process.exit(0)
})
