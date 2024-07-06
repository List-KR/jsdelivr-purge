import {chunk} from 'es-toolkit'
import type * as Types from './types.js'

/**
 * @name ReplaceStringWithBooleanInObject
 * @description Replace string-based boolean properties with real booleans in an object.
 * @param {unknown} Source A Object.
 * @returns {unknown} A modified object.
 */
export function ReplaceStringWithBooleanInObject(Source: unknown): unknown {
	for (const Property of Object.keys(Source)) {
		switch (Source[Property]) {
			case 'true':
				Source[Property] = true
				break
			case 'false':
				Source[Property] = false
				break
			default:
				break
		}

		if (typeof Source[Property] === 'object') {
			ReplaceStringWithBooleanInObject(Source[Property])
		}
	}

	return Source
}

/**
 * @name IncludePropertiesInObject
 * @description Check if an same object exists in an array.
 * @param {unknown[]} CustomObjectArray An array of objects.
 * @param {unknown} CompareObject An object to compare.
 * @returns {boolean} The calculated boolean.
 */
export function IncludePropertiesInObject(CustomObjectArray: unknown[], CompareObject: unknown): boolean {
	return CustomObjectArray.some(CustomObject => Object.entries(CompareObject).every(([Key, Value]) => CustomObject[Key] === Value))
}

/**
 * @name GroupStringsByNumber
 * @description Groups a RemainingFilenamesArray into subarrays based on a specified group size. A group with latest tag will be separated from others.
 * @param	{Types.RemainingFilenamesArrayType[]} RemainingObjectArray A RemainingFilenamesArray to group.
 * @param	{number} {Count} The maximum number of elements in each subarray.
 * @returns {Types.RemainingFilenamesArrayType[][]} A RemainingFilenamesArray of subarrays.
 */
export function GroupRequestsByNumberWithBranch(RemainingObjectArray: Types.RemainingFilenamesArrayType[], Count: number): Types.RemainingFilenamesArrayType[][] {
	if (RemainingObjectArray.every(RemainingObject => RemainingObject.BranchOrTag === RemainingObjectArray[0].BranchOrTag)) {
		return chunk(RemainingObjectArray, Count) as Types.RemainingFilenamesArrayType[][]
	}

	const SplittedArray: Types.RemainingFilenamesArrayType[][] = []
	SplittedArray.push(...chunk(RemainingObjectArray.filter(RemainingObject => RemainingObject.BranchOrTag === 'latest'), Count) as Types.RemainingFilenamesArrayType[][])
	SplittedArray.push(...chunk(RemainingObjectArray.filter(RemainingObject => RemainingObject.BranchOrTag !== 'latest'), Count) as Types.RemainingFilenamesArrayType[][])

	return SplittedArray
}
