import * as Actions from '@actions/core'
import * as Got from 'got'
import * as GitHub from '@octokit/rest'
import * as Threads from 'worker_threads'
import * as Dotenv from 'dotenv'
import { DateTime } from 'luxon'

Dotenv.config()

Threads.parentPort.on('message', async function(Message: string) {
  Actions.info(`Thread handling ${Message} started.`)

  // Variables 
  const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
  const [RepoOwner, RepoName] = process.env['GITHUB_REPO'].split('/')
  const ChangedFiles:string[] = []
  let LatestWorkflowRunTime:number = Number.MAX_SAFE_INTEGER
  
  // Check GitHub workflow history to calcuate duration of commits.
  const ListWorkflowRuns = await Octokit.rest.actions.listWorkflowRuns({
    owner: RepoOwner, repo: RepoName, workflow_id: process.env['GITHUB_WORKFLOW_REF'].match(new RegExp(`(?<=${process.env['GITHUB_REPO']}\/\.github\/workflows\/).+\.yml(?=@refs\/)`))[0],
    page: Number.MAX_SAFE_INTEGER, per_page: 100 })

    ListWorkflowRuns.data.workflow_runs.forEach((Run) => {
      if (Run.status === 'completed' && Run.conclusion === 'success' &&
      DateTime.fromFormat(Run.updated_at, "yyyy-MM-dd'T'HH:mm:ssZZ").toMillis() < LatestWorkflowRunTime) {
        LatestWorkflowRunTime = DateTime.fromFormat(Run.updated_at, "yyyy-MM-dd'T'HH:mm:ssZZ").toMillis()
      }
    })

  // Calcuate time including the delay.
  if (LatestWorkflowRunTime === Number.MAX_SAFE_INTEGER) {
    LatestWorkflowRunTime = 1199145600000 // Jan 1, 2008 - The year that GitHub was founded.
    Actions.info(`This workflow run is first jsdelivr-purge run of ${process.env['GITHUB_REPO']}.`)
  }

  const DateTimeDelay = DateTime.fromFormat(process.env['INPUT_DELAY'], 'H:m:s'); 
  const CommitTime:DateTime = DateTime.fromMillis(LatestWorkflowRunTime).minus({
    hours: DateTimeDelay.hour,
    minutes: DateTimeDelay.minute,
    seconds: DateTimeDelay.second
  })

  // Get a list of changed files during the duration.
  const ListCommits = await Octokit.rest.repos.listCommits({
    owner: RepoOwner, repo: RepoName, page: Number.MAX_SAFE_INTEGER, per_page: 100,
    since: CommitTime.toISO()})

    ListCommits.data.forEach((Commit) => {
      Octokit.rest.git.getTree({ owner: RepoOwner, repo: RepoName, tree_sha: Commit.commit.tree.sha }).then((TreeData) => {
        for (const Tree of TreeData.data.tree) {
          if (typeof Tree.path === 'undefined') continue
          if (!(ChangedFiles.some((ChangedFile) => { return ChangedFile === Tree.path })) || ChangedFiles.length === 0) ChangedFiles.push(Tree.path)
        }
      })
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
  ChangedFiles.forEach(async (Changed) => {
    const CDNResponses:Array<string> = []
    while(CDNResponses.every(async (CDNResponse) => {
      const CDNStatus:JSON = await Got.got.get(`https://purge.jsdelivr.net/status/${CDNResponse}`, { https: { minVersion: 'TLSv1.3' }}).json()
      return !(CDNStatus['status'] === 'finished' || CDNStatus['status'] === 'failed')
    })) {
      const CDNRequest:JSON = await Got.got.post('https://purge.jsdelivr.net/', {
        headers: { 'cache-control': 'no-cache' },
        body: `{"path":["/gh/${RepoOwner}/${RepoName}@${Message}/${Changed}"]}`,
        https: { 'minVersion': 'TLSv1.3' }}).json()
      Actions.info(`Thread for ${Message}: Sent new request having ${CDNRequest['id']} ID.`)
      CDNResponses.push(CDNRequest['id'])
    }
    Actions.info(`Thread for ${Message}: Purged ${Changed}.`)
  })
  Actions.info(`Thread for ${Message}: All changed files are purged. Exiting...`)
  Threads.parentPort.close()
  process.exit(0)
})
