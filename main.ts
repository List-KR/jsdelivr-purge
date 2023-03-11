import * as Actions from '@actions/core'
import * as Threads from 'worker_threads'

const Branches = Actions.getMultilineInput('branches', { required: true })
var BrancheThreads:Threads.Worker[] = [] 

Actions.info(`The following branches will be processed:
${Branches.join(" - ")}
`)

Branches.forEach((Branche, Index) => {
  BrancheThreads.push(new Threads.Worker('./threads.js'))
  BrancheThreads[Index].postMessage({'Branche': Branche})
  BrancheThreads[Index].on('exit', () => {
    BrancheThreads = BrancheThreads.filter((element) => element === BrancheThreads[Index])
    if (!BrancheThreads.length) { return Actions.ExitCode }
  })
})
