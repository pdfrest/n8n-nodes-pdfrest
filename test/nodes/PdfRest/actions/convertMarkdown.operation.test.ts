import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertMarkdownDescription,
	convertMarkdownOperation,
} from '../../../../nodes/PdfRest/actions/convertMarkdown.operation';

function getOptionalField(name: string) {
	return convertMarkdownDescription[1].options?.find((field) => field.name === name);
}

function createContext(outputType: 'json' | 'file'): IExecuteSingleFunctions {
	return {
		getNodeParameter: (name: string, fallback: unknown) => {
			expect(name).toBe('options.outputType');
			expect(fallback).toBe('json');
			return outputType;
		},
		getNode: () => ({
			name: 'Convert PDF to Markdown',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('Convert PDF to Markdown operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertMarkdownOperation).toMatchObject({
			name: 'Convert PDF to Markdown',
			value: 'convertMarkdown',
			action: 'Convert · PDF to Markdown',
			routing: {
				request: {
					method: 'POST',
					url: '/markdown',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(convertMarkdownDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertMarkdown'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional field and header alphabetically', () => {
		const optionalFields = convertMarkdownDescription[1];

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertMarkdown'] } },
		});
		expect(optionalFields.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'outputType',
			'pageBreakComments',
			'pages',
			'responseType',
		]);
	});

	it('maps both output types and reveals output name only for a Markdown file', () => {
		expect(getOptionalField('outputType')).toMatchObject({
			displayName: 'Output Type',
			type: 'options',
			options: [
				{ name: 'JSON', value: 'json' },
				{ name: 'Markdown File', value: 'file' },
			],
			default: 'json',
			routing: { send: { type: 'body', property: 'output_type' } },
		});
		expect(getOptionalField('output')).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			displayOptions: { show: { outputType: ['file'] } },
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(getOptionalField('output')?.displayOptions?.show?.outputType).not.toContain(
			'json',
		);
	});

	it('omits inactive output and validates it only when provided for file output', async () => {
		const preSend = getOptionalField('output')?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();

		const jsonRequest: IHttpRequestOptions = {
			url: '/markdown',
			body: { id: 'resource-id', output_type: 'json', output: 'stale-name' },
		};
		await expect(preSend?.call(createContext('json'), jsonRequest)).resolves.toBe(jsonRequest);
		expect(jsonRequest.body).toEqual({ id: 'resource-id', output_type: 'json' });

		const omittedFileOutput: IHttpRequestOptions = {
			url: '/markdown',
			body: { id: 'resource-id', output_type: 'file' },
		};
		await expect(
			preSend?.call(createContext('file'), omittedFileOutput),
		).resolves.toBe(omittedFileOutput);

		const validFileOutput: IHttpRequestOptions = {
			url: '/markdown',
			body: { id: 'resource-id', output_type: 'file', output: 'document' },
		};
		await expect(
			preSend?.call(createContext('file'), validFileOutput),
		).resolves.toBe(validFileOutput);

		const invalidFileOutput: IHttpRequestOptions = {
			url: '/markdown',
			body: { id: 'resource-id', output_type: 'file', output: '' },
		};
		await expect(
			preSend?.call(createContext('file'), invalidFileOutput),
		).rejects.toThrow('Output File Name must contain at least one character.');
	});

	it('maps page-break comments and pages with exact defaults and routes', () => {
		expect(getOptionalField('pageBreakComments')).toMatchObject({
			displayName: 'Page Break Comments',
			type: 'options',
			options: [
				{ name: 'Off', value: 'off' },
				{ name: 'On', value: 'on' },
			],
			default: 'off',
			routing: { send: { type: 'body', property: 'page_break_comments' } },
		});
		expect(getOptionalField('pages')).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			placeholder: 'e.g. 1,2,5-10,12-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/markdown' };

		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
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

	it('omits Response-Type by default and supports requestId', async () => {
		const responseType = getOptionalField('responseType');
		const preSend = responseType?.routing?.send?.preSend?.[0];

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

		const synchronousRequest: IHttpRequestOptions = {
			url: '/markdown',
			headers: { 'Content-Type': 'application/json', 'Response-Type': '' },
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
		expect(synchronousRequest.headers).toEqual({ 'Content-Type': 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/markdown' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared body properties', () => {
		const publicDefinition = JSON.stringify(convertMarkdownDescription);
		const bodyProperties = convertMarkdownDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(convertMarkdownDescription.map((field) => field.name)).toEqual([
			'resourceId',
			'options',
		]);
		expect(bodyProperties).toEqual([
			'id',
			'output',
			'output_type',
			'page_break_comments',
			'pages',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
