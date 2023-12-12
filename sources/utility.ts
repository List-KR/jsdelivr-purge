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

function GroupObjectByNumber(StringOrObject: unknown[], GroupSize: number): unknown[][] {
	const SplittedArray = new Array<unknown[]>(Math.ceil(StringOrObject.length / GroupSize))
	for (var I = 0; I < SplittedArray.length; I++) {
		SplittedArray[I] = StringOrObject.slice(I === 0 ? I : I * GroupSize, (I + 1) * GroupSize > StringOrObject.length ? StringOrObject.length : (I + 1) * GroupSize)
	}

	return SplittedArray
}

/**
 * @name GroupStringsByNumber
 * @description Groups a RemainingFilenamesArray into subarrays based on a specified group size.
 */
export function GroupRequestsByNumberWithBranch(RemainingObjectArray: Types.RemainingFilenamesArrayType[], GroupSize: number): Types.RemainingFilenamesArrayType[][] {
	if (RemainingObjectArray.every(RemainingObject => RemainingObject.BranchOrTag === RemainingObjectArray[0].BranchOrTag)) {
		return GroupObjectByNumber(RemainingObjectArray, GroupSize) as Types.RemainingFilenamesArrayType[][]
	}

	const SplittedArray: Types.RemainingFilenamesArrayType[][] = []
	SplittedArray.push(...GroupObjectByNumber(RemainingObjectArray.filter(RemainingObject => RemainingObject.BranchOrTag === 'latest'), GroupSize) as Types.RemainingFilenamesArrayType[][])
	SplittedArray.push(...GroupObjectByNumber(RemainingObjectArray.filter(RemainingObject => RemainingObject.BranchOrTag !== 'latest'), GroupSize) as Types.RemainingFilenamesArrayType[][])

	return SplittedArray
}
