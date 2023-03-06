import * as Actions from '@actions/core'
import * as Threads from 'worker_threads'

const Branches = Actions.getMultilineInput('branches', { required: true })
var BrancheThreads:Threads.Worker[] = [] 

Actions.info('The following branches will be processed:')
Branches.forEach(function(element) { Actions.info(`  - ${element}`) })

Branches.forEach(function(Branche, Index) {
  BrancheThreads.push(new Threads.Worker('./threads.js'))
  BrancheThreads[Index].postMessage({'Branche': Branche})
  BrancheThreads[Index].on('exit', function() {
    BrancheThreads = BrancheThreads.filter(function(element) { element === BrancheThreads[Index] })
    if (BrancheThreads.length === 0) { Actions.ExitCode }
  })
})