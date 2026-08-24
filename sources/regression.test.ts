import assert from 'node:assert/strict'
import test from 'node:test'
import {getWorkflowId} from './actions.js'
import {groupRequestsByNumberWithBranch} from './utility.js'

test('getWorkflowId accepts yml and yaml workflow refs', () => {
	assert.equal(getWorkflowId('List-KR/repo/.github/workflows/purge.yml@refs/heads/main'), 'purge.yml')
	assert.equal(getWorkflowId('List-KR/repo/.github/workflows/purge.yaml@refs/tags/v1'), 'purge.yaml')
	assert.throws(() => getWorkflowId('invalid'))
})

test('groupRequestsByNumberWithBranch handles empty and mixed requests', () => {
	assert.deepEqual(groupRequestsByNumberWithBranch([], 20), [])

	const requests = [
		{filename: 'latest-a', branchOrTag: 'latest'},
		{filename: 'main-a', branchOrTag: 'main'},
		{filename: 'latest-b', branchOrTag: 'latest'},
	]
	assert.deepEqual(groupRequestsByNumberWithBranch(requests, 20), [
		[requests[0], requests[2]],
		[requests[1]],
	])
})
