import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { splitDescription, splitOperation } from '../../../../nodes/PdfRest/actions/split.operation';

describe('Split PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(splitOperation).toMatchObject({
			name: 'Split PDF into Multiple Files',
			value: 'split',
			action: 'Modify · Split PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/split-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires a resource ID and exposes no public binary-file input', () => {
		expect(splitDescription.map((field) => field.name)).toEqual(['resourceId', 'options']);
		expect(splitDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['split'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});

		const publicDefinition = JSON.stringify(splitDescription);
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});

	it('routes optional output and literal pages[] fields with their constraints', () => {
		const optionalFields = splitDescription.find((field) => field.name === 'options');
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['split'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'pageRanges',
			'responseType',
		]);

		const output = optionalFields?.options?.find((field) => field.name === 'output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});

		const pages = optionalFields?.options?.find((field) => field.name === 'pageRanges');
		expect(pages).toMatchObject({
			displayName: 'Page Ranges',
			type: 'string',
			typeOptions: {
				multipleValues: true,
				multipleValueButtonText: 'Add Page Range',
			},
			default: [],
			routing: {
				send: {
					type: 'body',
					property: 'pages[]',
					propertyInDotNotation: false,
				},
			},
		});
		expect(pages?.description).toContain('omit this field');
	});

	it('routes Include-File-Info with its declared boolean default', async () => {
		const optionalFields = splitDescription.find((property) => property.name === 'options');
		const field = optionalFields?.options?.find((property) => property.name === 'includeFileInfo');
		expect(field).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});

		const request: IHttpRequestOptions = { url: '/split-pdf' };
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

	it('omits Response-Type by default and supports asynchronous requests', async () => {
		const optionalFields = splitDescription.find((property) => property.name === 'options');
		const field = optionalFields?.options?.find((property) => property.name === 'responseType');
		expect(field).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
			routing: { send: {} },
		});

		const preSend = field?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();
		const synchronousRequest: IHttpRequestOptions = {
			url: '/split-pdf',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/split-pdf' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});
});
