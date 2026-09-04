import type {
	IBinaryData,
	IDataObject,
	IHttpRequestOptions,
	INodeExecutionData,
	PreSendAction,
} from 'n8n-workflow';

export const PDFREST_REQUEST_MANIFEST_PREFIX = 'pdfRest request manifest ';
export const PDFREST_REQUEST_DIAGNOSTICS_PARAMETER = 'requestDiagnostics';

type InputLocation = 'body' | 'header' | 'query';

export interface PdfRestRequestInput {
	location: InputLocation;
	name: string;
	type: string;
	binaryField?: string;
	mimeType?: string;
	bytes?: number;
}

export interface PdfRestRequestManifest {
	node: string;
	itemIndex: number;
	method?: string;
	operation: string;
	inputs: PdfRestRequestInput[];
}

const omittedHeaderNames = new Set([
	'accept',
	'api-key',
	'authorization',
	'content-length',
	'content-type',
	'cookie',
	'proxy-authorization',
	'set-cookie',
	'user-agent',
]);

function getValueType(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	if (Buffer.isBuffer(value)) return 'binary';
	return typeof value;
}

function getBinaryInputs(
	value: unknown,
	binary: INodeExecutionData['binary'],
): Array<{ name: string; data: IBinaryData & { bytes?: number } }> {
	if (!binary) return [];
	const candidates = Array.isArray(value) ? value : [value];
	return candidates.flatMap((candidate) => {
		if (typeof candidate !== 'string' || !binary[candidate]) return [];
		return [{ name: candidate, data: binary[candidate] }];
	});
}

function describeFields(
	value: IHttpRequestOptions['body'] | IHttpRequestOptions['headers'] | IDataObject | undefined,
	location: InputLocation,
	binary: INodeExecutionData['binary'],
): PdfRestRequestInput[] {
	if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.isBuffer(value)) {
		return [];
	}

	return Object.entries(value).flatMap(([name, fieldValue]) => {
		if (fieldValue === undefined || fieldValue === null) return [];
		if (location === 'header' && omittedHeaderNames.has(name.toLowerCase())) return [];

		const binaryInputs = getBinaryInputs(fieldValue, binary);
		if (binaryInputs.length > 0) {
			return binaryInputs.map(({ name: binaryField, data }) => ({
				location,
				name,
				type: 'inputFile',
				binaryField,
				mimeType: data.mimeType,
				bytes: data.bytes,
			}));
		}

		return [{ location, name, type: getValueType(fieldValue) }];
	});
}

/**
 * Logs a value-free input manifest for every pdfRest declarative request.
 */
export function createPdfRestRequestLogger(): PreSendAction {
	return async function logPdfRestRequest(requestOptions): Promise<IHttpRequestOptions> {
		if (this.getNodeParameter(PDFREST_REQUEST_DIAGNOSTICS_PARAMETER, false) !== true) {
			return requestOptions;
		}

		const input = this.getInputData();
		const operation = this.getNodeParameter('operation', 'unknown');
		const manifest: PdfRestRequestManifest = {
			node: this.getNode().name,
			itemIndex: this.getItemIndex(),
			method: requestOptions.method,
			operation: typeof operation === 'string' ? operation : 'unknown',
			inputs: [
				...describeFields(requestOptions.body, 'body', input.binary),
				...describeFields(requestOptions.qs, 'query', input.binary),
				...describeFields(requestOptions.headers, 'header', input.binary),
			],
		};

		// Keep this as one JSON line so CI can correlate it with aggregated errors.
		this.logger.debug(`${PDFREST_REQUEST_MANIFEST_PREFIX}${JSON.stringify(manifest)}`);

		return requestOptions;
	};
}
