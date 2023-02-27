import * as Actions from '@actions/core'
import * as Exec from '@actions/exec'
import * as GitHub from '@actions/github'
import * as DateTime from 'date-and-time'

const RepoName = Actions.getInput('RepoName', { required: true })
const RepoBranches = Actions.getMultilineInput('RepoBranches', { required: true })

