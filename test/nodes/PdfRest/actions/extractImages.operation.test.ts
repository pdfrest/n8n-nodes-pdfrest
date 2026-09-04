import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	extractImagesDescription,
	extractImagesOperation,
} from '../../../../nodes/PdfRest/actions/extractImages.operation';

describe('Extract Images operation', () => {
	const optionalFields = extractImagesDescription.find((field) => field.name === 'options');

	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(extractImagesOperation).toMatchObject({
			name: 'Extract Embedded Images from PDF',
			value: 'extractImages',
			action: 'Extract · Images from PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/extracted-images',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires and routes the public resource ID input', () => {
		const resourceId = extractImagesDescription.find((field) => field.name === 'resourceId');

		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['extractImages'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('declares the optional request fields alphabetically with exact routes and defaults', () => {
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['extractImages'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'pages',
			'responseType',
		]);

		const output = optionalFields?.options?.find((field) => field.name === 'output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.description).toContain('without a file extension');

		const pages = optionalFields?.options?.find((field) => field.name === 'pages');
		expect(pages).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			placeholder: 'e.g. 1,2,5-10,12-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
	});

	it('routes Include-File-Info with its declared false default', async () => {
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(includeFileInfo?.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/extracted-images' };
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

	it('omits Response-Type by default and supports the asynchronous branch', async () => {
		const responseType = optionalFields?.options?.find((field) => field.name === 'responseType');
		expect(responseType).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
			routing: { send: {} },
		});

		const preSend = responseType?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();
		const synchronousRequest: IHttpRequestOptions = {
			url: '/extracted-images',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await preSend?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/extracted-images' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes only the ID branch and no public binary-file input', () => {
		const publicDefinition = JSON.stringify(extractImagesDescription);

		expect(extractImagesDescription.map((field) => field.name)).toEqual(['resourceId', 'options']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
