import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	extractTextDescription,
	extractTextOperation,
} from '../../../../nodes/PdfRest/actions/extractText.operation';

function getOptionalField(name: string) {
	return extractTextDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

describe('Extract Text operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(extractTextOperation).toMatchObject({
			name: 'Extract Text from PDF',
			value: 'extractText',
			action: 'Extract · Text from PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/extracted-text',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires only the public resource ID input branch', () => {
		expect(extractTextDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['extractText'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups the declared optional properties and headers alphabetically', () => {
		const optionalFields = extractTextDescription[1];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['extractText'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'fullText',
			'includeFileInfo',
			'output',
			'outputType',
			'pages',
			'preserveLineBreaks',
			'responseType',
			'wordCoordinates',
			'wordStyle',
		]);
	});

	it('maps the full-text, page, and word metadata options exactly', () => {
		expect(getOptionalField('fullText')).toMatchObject({
			displayName: 'Full Text',
			type: 'options',
			options: [
				{ name: 'By Page', value: 'by_page' },
				{ name: 'Document', value: 'document' },
				{ name: 'Off', value: 'off' },
			],
			default: 'document',
			routing: { send: { type: 'body', property: 'full_text' } },
		});
		expect(getOptionalField('pages')).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});

		for (const [name, property] of [
			['wordCoordinates', 'word_coordinates'],
			['wordStyle', 'word_style'],
		] as const) {
			expect(getOptionalField(name)).toMatchObject({
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				routing: { send: { type: 'body', property } },
			});
		}
	});

	it('omits Preserve Line Breaks when full text is off', async () => {
		const preserveLineBreaks = getOptionalField('preserveLineBreaks');
		expect(preserveLineBreaks).toMatchObject({
			displayName: 'Preserve Line Breaks',
			type: 'options',
			options: [
				{ name: 'Off', value: 'off' },
				{ name: 'On', value: 'on' },
			],
			default: 'off',
			displayOptions: { hide: { fullText: ['off'] } },
			routing: { send: { type: 'body', property: 'preserve_line_breaks' } },
		});

		const preSend = preserveLineBreaks?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();
		const activeRequest: IHttpRequestOptions = {
			url: '/extracted-text',
			body: { id: 'resource-id', full_text: 'document', preserve_line_breaks: 'on' },
		};
		await preSend?.call(
			{
				getNodeParameter: (name: string, fallback: unknown) => {
					expect(name).toBe('options.fullText');
					expect(fallback).toBe('document');
					return 'document';
				},
			} as unknown as IExecuteSingleFunctions,
			activeRequest,
		);
		expect(activeRequest.body).toEqual({
			id: 'resource-id',
			full_text: 'document',
			preserve_line_breaks: 'on',
		});

		const inactiveRequest: IHttpRequestOptions = {
			url: '/extracted-text',
			body: { id: 'resource-id', full_text: 'off', preserve_line_breaks: 'on' },
		};
		await preSend?.call(
			{ getNodeParameter: () => 'off' } as unknown as IExecuteSingleFunctions,
			inactiveRequest,
		);
		expect(inactiveRequest.body).toEqual({ id: 'resource-id', full_text: 'off' });
	});

	it('reveals and sends the output filename only for file output', async () => {
		expect(getOptionalField('outputType')).toMatchObject({
			displayName: 'Output Type',
			type: 'options',
			options: [
				{ name: 'File', value: 'file' },
				{ name: 'JSON', value: 'json' },
			],
			default: 'json',
			routing: { send: { type: 'body', property: 'output_type' } },
		});

		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			displayOptions: { show: { outputType: ['file'] } },
			routing: { send: { type: 'body', property: 'output' } },
		});
		const preSend = output?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();

		const fileRequest: IHttpRequestOptions = {
			url: '/extracted-text',
			body: { id: 'resource-id', output_type: 'file', output: 'words' },
		};
		await preSend?.call(
			{ getNodeParameter: () => 'file' } as unknown as IExecuteSingleFunctions,
			fileRequest,
		);
		expect(fileRequest.body).toEqual({
			id: 'resource-id',
			output_type: 'file',
			output: 'words',
		});

		const jsonRequest: IHttpRequestOptions = {
			url: '/extracted-text',
			body: { id: 'resource-id', output_type: 'json', output: 'stale-name' },
		};
		await preSend?.call(
			{
				getNodeParameter: (name: string, fallback: unknown) => {
					expect(name).toBe('options.outputType');
					expect(fallback).toBe('json');
					return 'json';
				},
			} as unknown as IExecuteSingleFunctions,
			jsonRequest,
		);
		expect(jsonRequest.body).toEqual({ id: 'resource-id', output_type: 'json' });
	});

	it('routes Include-File-Info and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		const includeRequest: IHttpRequestOptions = { url: '/extracted-text' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.includeFileInfo');
					return false;
				},
			} as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
		});
		const synchronousRequest: IHttpRequestOptions = {
			url: '/extracted-text',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/extracted-text' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared optional properties', () => {
		const publicDefinition = JSON.stringify(extractTextDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = extractTextDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'full_text',
			'output',
			'output_type',
			'pages',
			'preserve_line_breaks',
			'word_coordinates',
			'word_style',
		]);
	});
});
