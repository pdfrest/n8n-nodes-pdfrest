import type {
	IBinaryData,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	getResourceDescription,
	getResourceOperation,
} from '../../../../nodes/PdfRest/actions/getResource.operation';

describe('Retrieve Resource operation', () => {
	it('uses the OpenAPI resource retrieval route', () => {
		expect(getResourceOperation).toMatchObject({
			name: 'Retrieve Resource or Its URL by ID',
			value: 'getResource',
			action: 'Files · Retrieve Files by ID',
			routing: {
				request: {
					method: 'GET',
					url: '=/resource/{{$parameter.resourceId}}',
				},
			},
		});

		const request = getResourceOperation.routing?.request;
		expect(request).not.toHaveProperty('body');
		expect(request?.headers).toBeUndefined();
	});

	it('interpolates the required resource ID into the path', () => {
		const resourceId = getResourceDescription.find((field) => field.name === 'resourceId');

		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['getResource'] } },
		});
		expect(getResourceOperation.routing?.request?.url).toContain('{{$parameter.resourceId}}');
		expect(resourceId?.routing).toBeUndefined();
	});

	it('routes the required format enum as a query parameter with the URL default', () => {
		const format = getResourceDescription.find((field) => field.name === 'format');

		expect(format).toMatchObject({
			displayName: 'Format',
			name: 'format',
			type: 'options',
			options: [
				{ name: 'File', value: 'file' },
				{ name: 'URL', value: 'url' },
				{ name: 'File Information', value: 'info' },
			],
			default: 'url',
			required: true,
			displayOptions: { show: { operation: ['getResource'] } },
			routing: {
				send: { type: 'query', property: 'format' },
				output: {
					postReceive: [expect.any(Function)],
				},
			},
		});
		expect(format?.routing?.send?.preSend).toHaveLength(1);
	});

	it('receives the File format as binary data without changing JSON response formats', async () => {
		const format = getResourceDescription.find((field) => field.name === 'format');
		const prepareResponse = format?.routing?.send?.preSend?.[0];
		const createContext = (selectedFormat: string) =>
			({
				getNodeParameter: (name: string) => {
					expect(name).toBe('format');
					return selectedFormat;
				},
			}) as unknown as IExecuteSingleFunctions;

		const fileRequest: IHttpRequestOptions = {
			url: '/resource/example-id?format=file',
			headers: { Accept: 'application/json' },
		};
		await prepareResponse?.call(createContext('file'), fileRequest);
		expect(fileRequest).toMatchObject({
			encoding: 'arraybuffer',
			headers: { Accept: '*/*' },
		});

		const urlRequest: IHttpRequestOptions = {
			url: '/resource/example-id?format=url',
			headers: { Accept: 'application/json' },
		};
		await prepareResponse?.call(createContext('url'), urlRequest);
		expect(urlRequest).toEqual({
			url: '/resource/example-id?format=url',
			headers: { Accept: 'application/json' },
		});
	});

	it('stores File responses in the configured output data field', () => {
		const outputFileDataFieldName = getResourceDescription.find(
			(field) => field.name === 'outputFileDataFieldName',
		);

		expect(outputFileDataFieldName).toMatchObject({
			displayName: 'Output File Data Field Name',
			name: 'outputFileDataFieldName',
			type: 'string',
			default: 'data',
			required: true,
			displayOptions: {
				show: { operation: ['getResource'], format: ['file'] },
			},
		});
	});

	it('adds the response filename and resource URL to File output metadata', async () => {
		const format = getResourceDescription.find((field) => field.name === 'format');
		const addMetadata = format?.routing?.output?.postReceive?.[0];
		expect(typeof addMetadata).toBe('function');
		if (typeof addMetadata !== 'function') throw new Error('Expected a post-receive function');

		const fileContents = Buffer.from('%PDF example');
		let preparedFileName: string | undefined;
		let preparedMimeType: string | undefined;
		const preparedBinaryData: IBinaryData = {
			data: 'encoded-file',
			mimeType: 'application/pdf',
			fileExtension: 'pdf',
		};
		const context = {
			getNodeParameter: (name: string) => {
				const parameters: Record<string, string> = {
					format: 'file',
					outputFileDataFieldName: 'document',
					resourceId: 'resource id',
				};
				return parameters[name];
			},
			getCredentials: async (name: string) => {
				expect(name).toBe('pdfRestApi');
				return { baseUrl: 'https://api.pdfrest.com/' };
			},
			helpers: {
				prepareBinaryData: async (
					body: Buffer,
					fileName?: string,
					mimeType?: string,
				) => {
					expect(body).toEqual(fileContents);
					preparedFileName = fileName;
					preparedMimeType = mimeType;
					return preparedBinaryData;
				},
			},
		} as unknown as IExecuteSingleFunctions;
		const response: IN8nHttpFullResponse = {
			body: fileContents,
			headers: {
				'content-disposition':
					"attachment; filename=fallback.pdf; filename*=UTF-8''01-sample-pdf_pdfrest_split-pdf_1.pdf",
				'content-type': 'application/pdf; charset=binary',
			},
			statusCode: 200,
		};
		const items: INodeExecutionData[] = [{ json: { previous: 'response body' } }];

		const result = await addMetadata.call(context, items, response);

		expect(preparedFileName).toBe('01-sample-pdf_pdfrest_split-pdf_1.pdf');
		expect(preparedMimeType).toBe('application/pdf');
		expect(result).toEqual([
			{
				json: {},
				binary: {
					document: {
						...preparedBinaryData,
						directory: 'https://api.pdfrest.com/resource/resource%20id?format=file',
					},
				},
			},
		]);
	});

	it('leaves URL responses unchanged', async () => {
		const format = getResourceDescription.find((field) => field.name === 'format');
		const addMetadata = format?.routing?.output?.postReceive?.[0];
		if (typeof addMetadata !== 'function') throw new Error('Expected a post-receive function');
		const items: INodeExecutionData[] = [{ json: { url: 'https://example.com/file.pdf' } }];
		const context = {
			getNodeParameter: () => 'url',
		} as unknown as IExecuteSingleFunctions;

		const result = await addMetadata.call(context, items, {
			body: items[0].json,
			headers: { 'content-type': 'application/json' },
			statusCode: 200,
		});

		expect(result).toBe(items);
	});

	it('sends Include-File-Info with its false OpenAPI default', async () => {
		const optionalFields = getResourceDescription.find((field) => field.name === 'options');
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['getResource'] } },
		});

		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(includeFileInfo?.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/resource/example-id?format=url' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.includeFileInfo');
					return false;
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.headers).toEqual({ 'Include-File-Info': false });
	});

	it('does not expose undeclared body, input-file, or Response-Type parameters', () => {
		const fieldNames = getResourceDescription.map((field) => field.name);
		const publicDefinition = JSON.stringify(getResourceDescription);

		expect(fieldNames).toEqual([
			'resourceId',
			'format',
			'outputFileDataFieldName',
			'options',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('responseType');
		expect(
			getResourceDescription.some(
				(field) =>
					field.routing?.send?.type === 'body' ||
					field.options?.some((option) => option.routing?.send?.type === 'body'),
			),
		).toBe(false);
	});
});
