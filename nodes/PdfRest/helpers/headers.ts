import type { IHttpRequestOptions, INodeProperties, PreSendAction } from 'n8n-workflow';

interface HeaderPreSendOptions {
	headerName: string;
	omitBlank?: boolean;
	parameterName: string;
}

function createHeaderPreSend({
	headerName,
	omitBlank = false,
	parameterName,
}: HeaderPreSendOptions): PreSendAction {
	return async function setHeader(requestOptions): Promise<IHttpRequestOptions> {
		const value = this.getNodeParameter(parameterName);
		const isBlank = typeof value === 'string' && value.trim() === '';

		if (omitBlank && isBlank) {
			requestOptions.headers = Object.fromEntries(
				Object.entries(requestOptions.headers ?? {}).filter(
					([name]) => name.toLowerCase() !== headerName.toLowerCase(),
				),
			);
			return requestOptions;
		}

		requestOptions.headers = {
			...requestOptions.headers,
			[headerName]: value as string | number | boolean,
		};

		return requestOptions;
	};
}

function createHeaderDisplayOptions(operation: string): INodeProperties['displayOptions'] {
	return {
		show: {
			operation: [operation],
		},
	};
}

export function createIncludeFileInfoField(operation: string): INodeProperties {
	// Callers retain the operation argument for a consistent helper API. The
	// enclosing Optional Fields collection owns operation visibility.
	void operation;

	return {
		displayName: 'Include File Info',
		name: 'includeFileInfo',
		type: 'boolean',
		default: false,
		// Header fields are nested in an operation-specific Optional Fields
		// collection. Applying a second visibility rule here prevents n8n from
		// offering the collection item in the editor.
		description: 'Whether to include detailed metadata for detected input and output files',
		routing: {
			send: {
				preSend: [
					createHeaderPreSend({
						headerName: 'Include-File-Info',
						parameterName: 'options.includeFileInfo',
					}),
				],
			},
		},
	};
}

export function createResponseTypeField(operation: string): INodeProperties {
	// Callers retain the operation argument for a consistent helper API. The
	// enclosing Optional Fields collection owns operation visibility.
	void operation;

	return {
		displayName: 'Response Type',
		name: 'responseType',
		type: 'options',
		options: [
			{
				name: 'Synchronous Response',
				value: '',
			},
			{
				name: 'Request ID',
				value: 'requestId',
			},
		],
		default: '',
		// The enclosing Optional Fields collection controls this field's
		// operation visibility.
		description: 'Choose whether to wait for the completed response or return a request ID',
		routing: {
			send: {
				preSend: [
					createHeaderPreSend({
						headerName: 'Response-Type',
						omitBlank: true,
						parameterName: 'options.responseType',
					}),
				],
			},
		},
	};
}

export function createContentFilenameField(operation: string): INodeProperties {
	return {
		displayName: 'Content Filename',
		name: 'contentFilename',
		type: 'string',
		default: '',
		displayOptions: createHeaderDisplayOptions(operation),
		description: 'The filename and extension for a single binary upload',
		routing: {
			send: {
				preSend: [
					createHeaderPreSend({
						headerName: 'Content-Filename',
						omitBlank: true,
						parameterName: 'options.contentFilename',
					}),
				],
			},
		},
	};
}
