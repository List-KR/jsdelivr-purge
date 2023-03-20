import * as Actions from '@actions/core'
import * as Exec from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as Threads from 'worker_threads'
import * as Dotenv from 'dotenv'
import { DateTime } from 'luxon'

Dotenv.config()

Threads.parentPort.on('message', async function(Message: string) {
  Actions.info(`Thread handling ${Message} started.`)

  // Variables 
  const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
  const RepoName = process.env['GITHUB_REPO'].split('/')[1]
  const RepoOwner = process.env['GITHUB_REPO'].split('/')[0]
  var ChangedFiles:Array<string> = []
  var LatestWorkflowRunTime:number = Number.MAX_SAFE_INTEGER
  
  // Check GitHub workflow history to calcuate duration of commits.
  await Octokit.rest.actions.listWorkflowRunsForRepo({
    owner: RepoOwner, repo: RepoName, branch: Message, page: Number.MAX_SAFE_INTEGER, per_page: 100 })
    .then((Data) => {
      var WorkflowRunIDs:Array<number> = Data.data.workflow_runs.map(element => element.workflow_id )
      WorkflowRunIDs.forEach((WorkflowRunID) => {
        Octokit.rest.actions.getWorkflowRun({ owner: RepoOwner, repo: RepoName, run_id: WorkflowRunID }).then((Data) => {
          if (Data.data.status === 'completed' && Data.data.name === process.env['GITHUB_WORKFLOW_NAME'] &&
          DateTime.fromFormat(Data.data.created_at, "yyyy-MM-dd'T'HH:mm:ssZZ").toMillis() < LatestWorkflowRunTime) {
            LatestWorkflowRunTime = DateTime.fromFormat(Data.data.created_at, "yyyy-MM-dd'T'HH:mm:ssZZ").toMillis()
          }
        })
      })
    })

  // Calcuate time including the delay.
  if (LatestWorkflowRunTime === Number.MAX_SAFE_INTEGER) {
    LatestWorkflowRunTime = 1199145600000 // Jan 1, 2008 - The year that GitHub was founded.
    Actions.info(`This workflow run is first jsdelivr-purge run of ${process.env['GITHUB_REPO']}.`)
  }
  var CommitTime:DateTime = DateTime.fromMillis(LatestWorkflowRunTime).minus({
    hours: DateTime.fromFormat(process.env['INPUT_DELAY'], 'H:m:s').hour,
    minutes: DateTime.fromFormat(process.env['INPUT_DELAY'], 'H:m:s').minute,
    seconds: DateTime.fromFormat(process.env['INPUT_DELAY'], 'H:m:s').second
  })

  // Get a list of changed files during the duration.
  await Octokit.rest.repos.listCommits({
    owner: RepoOwner, repo: RepoName, page: Number.MAX_SAFE_INTEGER, per_page: 100,
    since: CommitTime.toISO()})
    .then((Data) => {
      Data.data.forEach((Commit) => {
        Commit.files.forEach((Files) => {
          ChangedFiles.forEach((Changed) => {
            if (Changed !== Files.previous_filename) ChangedFiles.push(Files.previous_filename)
            if (Changed !== Files.filename) ChangedFiles.push(Files.filename)
          })
        })
      })
    })
  
  if (!ChangedFiles.length) {
    Actions.info(`Thread for ${Message}: No files changes found. Exiting...`)
    Threads.parentPort.close()
  }
  
  Actions.info(`Thread for ${Message}: Found files changes during from to :
  ${ChangedFiles.join('\n  - ').replace(/^/, ' - ')}
  `)
  
  // Make requests
  ChangedFiles.forEach(async (Changed) => {
    var CDNResponses:Array<string> = []
    while(CDNResponses.every(async (CDNResponse) => {
      var CDNStatus = JSON.parse(await Exec.getExecOutput(`curl -X GET https://purge.jsdelivr.net/status/${CDNResponse}`).then(Result => Result.stdout ))['status']
      return !(CDNStatus === 'finished' || CDNStatus === 'failed')
    })) {
      var CDNRequest = await Exec.getExecOutput(`curl -X POST https://purge.jsdelivr.net/ 
      -H 'cache-control: no-cache' 
      -H 'content-type: application/json' 
      -d '{"path":["/gh/${RepoOwner}/${RepoName}@${Message}/${Changed}"]}'`)
      .then(Result => Result.stdout )
      Actions.info(`Thread for ${Message}: Sent new request having ${JSON.parse(CDNRequest)['id']} ID.`)
      CDNResponses.push(JSON.parse(CDNRequest)['id'])
    }
    Actions.info(`Thread for ${Message}: Purged ${Changed}.`)
  })
  Actions.info(`Thread for ${Message}: All changed files are purged. Exiting...`)
  Threads.parentPort.close()
})