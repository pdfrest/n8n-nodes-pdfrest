import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	translateDescription,
	translateOperation,
} from '../../../../nodes/PdfRest/actions/translate.operation';

describe('Translate PDF Text operation', () => {
	const optionalFields = translateDescription.find((field) => field.name === 'options');

	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(translateOperation).toMatchObject({
			name: 'Translate PDF, Markdown, or Plain Text',
			value: 'translate',
			action: 'Analyze · Translate PDF (AI)',
			routing: {
				request: {
					method: 'POST',
					url: '/translated-pdf-text',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required resource ID and output language', () => {
		const resourceId = translateDescription.find((field) => field.name === 'resourceId');
		const outputLanguage = translateDescription.find(
			(field) => field.name === 'outputLanguage',
		);

		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(outputLanguage).toMatchObject({
			displayName: 'Output Language',
			type: 'string',
			default: 'en',
			required: true,
			placeholder: 'e.g. en or zh-Hant',
			displayOptions: { show: { operation: ['translate'] } },
			routing: { send: { type: 'body', property: 'output_language' } },
		});
	});

	it('declares every optional field alphabetically with exact defaults and routes', () => {
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['translate'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'outputFormat',
			'outputType',
			'pages',
			'responseType',
		]);

		const outputFormat = optionalFields?.options?.find(
			(field) => field.name === 'outputFormat',
		);
		expect(outputFormat).toMatchObject({
			displayName: 'Output Format',
			type: 'options',
			options: [
				{ name: 'Plain Text', value: 'plaintext' },
				{ name: 'Markdown', value: 'markdown' },
			],
			default: 'markdown',
			routing: { send: { type: 'body', property: 'output_format' } },
		});

		const outputType = optionalFields?.options?.find((field) => field.name === 'outputType');
		expect(outputType).toMatchObject({
			displayName: 'Output Type',
			type: 'options',
			options: [
				{ name: 'File', value: 'file' },
				{ name: 'JSON', value: 'json' },
			],
			default: 'json',
			routing: { send: { type: 'body', property: 'output_type' } },
		});

		const pages = optionalFields?.options?.find((field) => field.name === 'pages');
		expect(pages).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			placeholder: 'e.g. 1,2,5-10,12-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
	});

	it('reveals the optional output name only for the file response branch', () => {
		const output = optionalFields?.options?.find((field) => field.name === 'output');

		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			displayOptions: { show: { outputType: ['file'] } },
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.displayOptions?.show?.outputType).not.toContain('json');
	});

	it('routes both declared headers and omits Response-Type by default', async () => {
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);
		const responseType = optionalFields?.options?.find((field) => field.name === 'responseType');

		expect(includeFileInfo).toMatchObject({
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(responseType).toMatchObject({
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
			routing: { send: {} },
		});

		const includeRequest: IHttpRequestOptions = { url: '/translated-pdf-text' };
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

		const responseRequest: IHttpRequestOptions = {
			url: '/translated-pdf-text',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes only the resource ID input branch and no binary-file fields', () => {
		const publicDefinition = JSON.stringify(translateDescription);

		expect(translateDescription.map((field) => field.name)).toEqual([
			'resourceId',
			'outputLanguage',
			'options',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
