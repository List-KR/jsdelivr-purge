import * as Actions from '@actions/core'
import * as Exec from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as DateTime from 'date-and-time'
import * as Threads from 'worker_threads'

Threads.parentPort.on('message', async function(Message: {Branch: string}) {
  Actions.info(`Thread handling ${Message?.Branch} started.`)

  // Variables 
  const Octokit = new GitHub.Octokit({ auth: process.env['GITHUB_TOKEN'] })
  const RepoName = process.env['GITHUB_REPO'].split('/')[1]
  const RepoOwner = process.env['GITHUB_REPO'].split('/')[0]
  var ChangedFiles:Array<string> = []
  var CommitDuration = new Date()
  
  // Check GitHub workflow history to calcuate duration of commits.
  await Octokit.rest.actions.listWorkflowRunsForRepo({
    owner: RepoOwner, repo: RepoName, branch: Message?.Branch })
    .then(function(Data) {
      // TODO: replace with better expression
      var WorkflowRunIDs:Array<number> = []
      Data.data.workflow_runs.forEach(function(WorkflowRun) {
        WorkflowRunIDs.push(WorkflowRun.workflow_id)
      })
      for (var WorkFlowRunID of WorkflowRunIDs) {
        Octokit.rest.actions.getWorkflowRun({ owner: RepoOwner, repo: RepoName, run_id: WorkFlowRunID }).then(function(Data) {
          Octokit.
        })
      }
    })

  // Get a list of changed files during the duration.
  await Octokit.rest.repos.listCommits({
    owner: RepoOwner, repo: RepoName})
    .then(function(Data) {
      Data.data.forEach(function(Commit) {
        Commit.files.forEach(function(Files) {
          ChangedFiles.forEach(function(Changed) {
            if (Changed !== Files.previous_filename) ChangedFiles.push(Files.previous_filename)
            if (Changed !== Files.filename) ChangedFiles.push(Files.filename)
          })
        })
      })
    })
  
  if (!ChangedFiles.length) {
    Actions.info(`Thread for ${Message?.Branch}: No files changes found. Exiting...`)
    Threads.parentPort.close()
  }
  
  Actions.info(`Thread for ${Message?.Branch}: Found files changes during from to :
  ${ChangedFiles.join('\n  - ').replace(/^/, ' - ')}
  `)
  
  // Make requests
  ChangedFiles.forEach(async function(Changed) {
    var CDNResponses:Array<string> = []
    while(CDNResponses.every(async function(CDNResponse) {
      var CDNStatus = JSON.parse(await Exec.getExecOutput(`curl -X GET https://purge.jsdelivr.net/status/${CDNResponse}`).then(function(Result) { return Result.stdout }))['status']
      return !(CDNStatus === 'finished' || CDNStatus === 'failed')
    })) {
      var CDNRequest = await Exec.getExecOutput(`curl -X POST https://purge.jsdelivr.net/ 
      -H 'cache-control: no-cache' 
      -H 'content-type: application/json' 
      -d '{"path":["/gh/${RepoOwner}/${RepoName}@${Message?.Branch}/${Changed}"]}'`)
      .then(function(Result) { return Result.stdout })
      Actions.info(`Thread for ${Message?.Branch}: Sent new request having ${JSON.parse(CDNRequest)['id']} ID.`)
      CDNResponses.push(JSON.parse(CDNRequest)['id'])
    }
    Actions.info(`Thread for ${Message?.Branch}: Purged ${Changed}.`)
  })
  Actions.info(`Thread for ${Message?.Branch}: All changed files are purged. Exiting...`)
  Threads.parentPort.close()
})