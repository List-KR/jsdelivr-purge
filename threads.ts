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
  const WorkflowHistory = await Octokit.rest.actions.listWorkflowRunsForRepo({
    owner: Actions.getInput('repo_owner', { required: true }), repo: Actions.getInput('repo_name', { required: true }), branch: Message?.Branch })

  // Get a list of changed files during the duration.
  await Octokit.rest.repos.listCommits({
    owner: Actions.getInput('repo_owner', { required: true }), repo: Actions.getInput('repo_name', { required: true }),  })
    .then(function(Data) {
      Data.data.forEach(function(Commit) {
        Commit.files.forEach(function(Files) {
          if (!ChangedFiles.some(function(Changed) { return Changed === Files.previous_filename })) ChangedFiles.push(Files.previous_filename)
          if (!ChangedFiles.some(function(Changed) { return Changed === Files.filename })) ChangedFiles.push(Files.filename)
        })
      })
    })
  Actions.info(`Thread for ${Message?.Branch}: Found files changes during from to :
  ${ChangedFiles.map(function(element) { return `  - ${element}` })}
  `)
  
  // Make requests
  ChangedFiles.forEach(function(Changed) {
    Actions.info(`Thread for ${Message?.Branch}: Sent the purge request to jsDelivr server:
    ${Exec.exec(`curl -X POST https://purge.jsdelivr.net/ 
    -H 'cache-control: no-cache' 
    -H 'content-type: application/json' 
    -d '{"path":["${Changed}"]}'`)}
    `)
  })
})