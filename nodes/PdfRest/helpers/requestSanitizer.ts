import type { IDataObject, IHttpRequestOptions, PreSendAction } from 'n8n-workflow';

function isPlainObject(value: unknown): value is IDataObject {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		!Buffer.isBuffer(value) &&
		!(value instanceof FormData) &&
		!(value instanceof URLSearchParams)
	);
}

function isEmptyValue(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		(Array.isArray(value) && value.length === 0) ||
		(typeof value === 'string' && value.trim() === '')
	);
}

function removeEmptyValues(parameters: unknown): IDataObject | undefined {
	if (!isPlainObject(parameters)) {
		return undefined;
	}

	const sanitizedParameters = Object.fromEntries(
		Object.entries(parameters).flatMap(([name, value]) => {
			if (Array.isArray(value)) {
				const entries = value.filter((entry) => !isEmptyValue(entry));
				return entries.length > 0 ? [[name, entries]] : [];
			}

			return isEmptyValue(value) ? [] : [[name, value]];
		}),
	);

	return Object.keys(sanitizedParameters).length > 0 ? sanitizedParameters : undefined;
}

/**
 * Creates the shared request hook that removes blank body and query parameters.
 */
export function createPdfRestRequestSanitizer(): PreSendAction {
	return async function sanitizePdfRestRequest(requestOptions): Promise<IHttpRequestOptions> {
		const body = removeEmptyValues(requestOptions.body);
		if (body !== undefined || isPlainObject(requestOptions.body)) {
			requestOptions.body = body as IHttpRequestOptions['body'];
		}

		const query = removeEmptyValues(requestOptions.qs);
		if (query !== undefined || isPlainObject(requestOptions.qs)) {
			requestOptions.qs = query;
		}

		return requestOptions;
	};
}
