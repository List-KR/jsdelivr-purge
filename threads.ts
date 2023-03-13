import * as Actions from '@actions/core'
import * as Exec from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as DateTime from 'date-and-time'
import * as Threads from 'worker_threads'

Threads.parentPort.on('message', async function(Message: {Branch: string}) {
  Actions.info(`Thread handling ${Message?.Branch} started.`)

  // Variables 
  const Octokit = new GitHub.Octokit({ auth: Actions.getInput('github_token', { required: true })})
  var ChangedFiles:Array<string> = []
  var CommitDuration = new Date()
  
  // Check GitHub workflow history to calcuate duration of commits.
  await Octokit.rest.actions.listWorkflowRunsForRepo({
    owner: Actions.getInput('repo_owner', { required: true }), repo: Actions.getInput('repo_name', { required: true }), branch: Message?.Branch })
    .then(function(Data) {
      for (var WorkflowRun of Data.data.workflow_runs) {
        
      }
    })

  // Get a list of changed files during the duration.
  await Octokit.rest.repos.listCommits({
    owner: Actions.getInput('repo_owner', { required: true }), repo: Actions.getInput('repo_name', { required: true }),  })
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
      -d '{"path":["/gh/${Actions.getInput('repo_owner', { required: true })}/${Actions.getInput('repo_name', { required: true })}@${Message?.Branch}/${Changed}"]}'`)
      .then(function(Result) { return Result.stdout })
      Actions.info(`Thread for ${Message?.Branch}: Sent new request having ${JSON.parse(CDNRequest)['id']} ID.`)
      CDNResponses.push(JSON.parse(CDNRequest)['id'])
    }
    Actions.info(`Thread for ${Message?.Branch}: Purged ${Changed}.`)
  })
  Actions.info(`Thread for ${Message?.Branch}: All changed files are purged. Exiting...`)
  Threads.parentPort.close()
})