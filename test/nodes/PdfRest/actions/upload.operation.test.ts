import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	uploadDescription,
	uploadOperation,
} from '../../../../nodes/PdfRest/actions/upload.operation';

describe('Upload Files operation', () => {
	it('uses the OpenAPI upload route without declaring a conflicting content type', () => {
		expect(uploadOperation).toMatchObject({
			name: 'Upload Files or URLs',
			value: 'upload',
			action: 'Files · Upload Files or URLs',
			routing: { request: { method: 'POST', url: '/upload' } },
		});
		expect(uploadOperation.routing?.request?.headers).toBeUndefined();
	});

	it('uploads either an input file or one or more public URLs', async () => {
		expect(uploadDescription.map((field) => field.name)).toEqual([
			'inputType',
			'inputFileDataFieldName',
			'url',
			'options',
		]);
		expect(uploadDescription[0]).toMatchObject({
			displayName: 'Input Source',
			name: 'inputType',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Input File', value: 'inputFile' },
				{ name: 'URL', value: 'url' },
			],
			default: 'inputFile',
			displayOptions: { show: { operation: ['upload'] } },
		});

		const fileField = uploadDescription[1];
		expect(fileField).toMatchObject({
			displayName: 'Input File Data Field Name',
			name: 'inputFileDataFieldName',
			type: 'string',
			typeOptions: {
				multipleValues: true,
				multipleValueButtonText: 'Add Input File Data Field Name',
			},
			default: ['data'],
			required: true,
			displayOptions: { show: { operation: ['upload'], inputType: ['inputFile'] } },
			routing: { send: { type: 'body', property: 'file' } },
		});
		expect(fileField.routing?.send?.preSend).toHaveLength(1);

		const fileBuffer = Buffer.from('pdf file contents');
		const fileRequest: IHttpRequestOptions = {
			url: '/upload',
			headers: { 'Content-Type': 'application/json' },
		};
		await fileField.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: () => 'document',
				helpers: {
					assertBinaryData: () => ({
						data: '',
						fileName: 'input.pdf',
						mimeType: 'application/pdf',
					}),
					getBinaryDataBuffer: async () => fileBuffer,
				},
			} as unknown as IExecuteSingleFunctions,
			fileRequest,
		);
		expect(fileRequest.body).toBeInstanceOf(FormData);
		const file = (fileRequest.body as unknown as FormData).get('file') as File;
		expect(file.name).toBe('input.pdf');
		expect(Buffer.from(await file.arrayBuffer())).toEqual(fileBuffer);
		expect(fileRequest.headers).toEqual({});

		const urlField = uploadDescription[2];
		expect(urlField).toMatchObject({
			displayName: 'File URLs',
			name: 'url',
			type: 'string',
			default: [],
			required: true,
			typeOptions: { multipleValues: true, multipleValueButtonText: 'Add URL' },
			displayOptions: { show: { operation: ['upload'], inputType: ['url'] } },
			routing: { send: { type: 'body', property: 'url' } },
		});
		expect(urlField.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = {
			url: '/upload',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: {
				url: ['https://example.com/first.pdf', 'https://example.com/second.pdf'],
			},
		};
		await urlField.routing?.send?.preSend?.[0]?.call({} as IExecuteSingleFunctions, request);

		expect(request.headers).toEqual({ Accept: 'application/json' });
		expect(request.body).toBeInstanceOf(FormData);
		expect((request.body as unknown as FormData).getAll('url')).toEqual([
			'https://example.com/first.pdf',
			'https://example.com/second.pdf',
		]);
	});

	it('groups the optional headers alphabetically', () => {
		const optionalFields = uploadDescription.find(({ name }) => name === 'options');
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['upload'] } },
		});
		expect(optionalFields?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'responseType',
		]);
	});

	it('routes Include-File-Info using its OpenAPI default', async () => {
		const optionalFields = uploadDescription.find(({ name }) => name === 'options');
		const field = optionalFields?.options?.find(({ name }) => name === 'includeFileInfo');
		expect(field).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		expect(field?.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/upload' };
		await field?.routing?.send?.preSend?.[0]?.call(
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

	it('omits Response-Type by default and supports asynchronous requests explicitly', async () => {
		const optionalFields = uploadDescription.find(({ name }) => name === 'options');
		const field = optionalFields?.options?.find(({ name }) => name === 'responseType');
		expect(field).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
		});

		const preSend = field?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();
		const synchronousRequest: IHttpRequestOptions = {
			url: '/upload',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await preSend?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/upload' };
		await preSend?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return 'requestId';
				},
			} as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('keeps Content-Filename hidden', () => {
		const publicDefinition = JSON.stringify(uploadDescription);
		expect(publicDefinition).toContain('inputFileDataFieldName');
		expect(publicDefinition).toContain('Input File');
		expect(publicDefinition).toContain('"property":"file"');
		expect(publicDefinition).not.toContain('contentFilename');
		expect(publicDefinition).not.toContain('Content Filename');
	});
});
