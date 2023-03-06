import * as Actions from '@actions/core'
import * as Exec from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as DateTime from 'date-and-time'
import * as Threads from 'worker_threads'

const Octokit = new GitHub.Octokit({ auth: Actions.getInput('github_token', { required: true })})

Threads.parentPort.on('message', async function(Message: {Branch: string}) {
  Actions.info(`Thread handling ${Message?.Branch} started.`)

  var ChangedFile:Array<string> = []
  const ActionHistory = await Octokit.rest.actions.listWorkflowRunsForRepo({
    owner: Actions.getInput('repo_owner', { required: true }), repo: Actions.getInput('repo_name', { required: true }), branch: Message?.Branch })
  await Octokit.rest.repos.listCommits({
    owner: Actions.getInput('repo_owner', { required: true }), repo: Actions.getInput('repo_name', { required: true }),  })
    .then(function(Data) {
      Data.data.forEach(function(Commit) {
        Commit.files.forEach(function(Files) {
          
        })
      })
    })
  Actions.info(`Thread for ${Message?.Branch}: Found files changes during from to :
  ${ChangedFile.map(function(element) { return `  - ${element}` })}
  `)
  
})