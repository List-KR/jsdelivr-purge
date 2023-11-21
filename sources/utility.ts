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
 * @description Groups an array of strings into subarrays based on a specified group size.
 * @param {string[]} Strings - The array of strings to be grouped.
 * @param {number} GroupSize - The size of each group.
 * @returns {string[][]} An array of subarrays, where each subarray contains a group of strings.
 */
export function GroupStringsByNumber(StringOrObject: unknown[], GroupSize: number): unknown[][] {
	const SplittedArray = new Array<unknown[]>(Math.ceil(StringOrObject.length / GroupSize))
	for (var I = 0; I < SplittedArray.length; I++) {
		SplittedArray[I] = StringOrObject.slice(I === 0 ? I : I * GroupSize, (I + 1) * GroupSize > StringOrObject.length ? StringOrObject.length : (I + 1) * GroupSize)
	}

	return SplittedArray
}
