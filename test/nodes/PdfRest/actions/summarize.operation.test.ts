import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	summarizeDescription,
	summarizeOperation,
} from '../../../../nodes/PdfRest/actions/summarize.operation';

function getOptionalField(name: string) {
	return summarizeDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

describe('Summarize PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(summarizeOperation).toMatchObject({
			name: 'Summarize PDF, Markdown, or Plain Text',
			value: 'summarize',
			action: 'Analyze · Summarize PDF (AI)',
			routing: {
				request: {
					method: 'POST',
					url: '/summarized-pdf-text',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		const resourceId = summarizeDescription[0];
		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['summarize'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional property and header alphabetically', () => {
		const optionalFields = summarizeDescription[1];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['summarize'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'outputFormat',
			'outputType',
			'pages',
			'responseType',
			'summaryFormat',
			'targetWordCount',
		]);
	});

	it('maps output format, output type, and pages with their declared defaults', () => {
		expect(getOptionalField('outputFormat')).toMatchObject({
			displayName: 'Output Format',
			type: 'options',
			options: [
				{ name: 'Plain Text', value: 'plaintext' },
				{ name: 'Markdown', value: 'markdown' },
			],
			default: 'markdown',
			routing: { send: { type: 'body', property: 'output_format' } },
		});
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
		expect(getOptionalField('pages')).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
	});

	it('maps summary format and target word count enums and constraints', () => {
		expect(getOptionalField('summaryFormat')).toMatchObject({
			displayName: 'Summary Format',
			type: 'options',
			options: [
				{ name: 'Abstract', value: 'abstract' },
				{ name: 'Action Items', value: 'action_items' },
				{ name: 'Bullet Points', value: 'bullet_points' },
				{ name: 'Highlight', value: 'highlight' },
				{ name: 'Numbered List', value: 'numbered_list' },
				{ name: 'Outline', value: 'outline' },
				{ name: 'Overview', value: 'overview' },
				{ name: 'Question and Answer', value: 'question_answer' },
				{ name: 'Table of Contents', value: 'table_of_contents' },
			],
			default: 'overview',
			routing: { send: { type: 'body', property: 'summary_format' } },
		});
		expect(getOptionalField('targetWordCount')).toMatchObject({
			displayName: 'Target Word Count',
			type: 'number',
			typeOptions: { minValue: 1, numberPrecision: 0 },
			default: 400,
			routing: { send: { type: 'body', property: 'target_word_count' } },
		});
	});

	it('reveals and sends the output filename only for file output', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			displayOptions: { show: { outputType: ['file'] } },
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.routing?.send?.preSend).toHaveLength(1);

		const preSend = output?.routing?.send?.preSend?.[0];
		const fileRequest: IHttpRequestOptions = {
			url: '/summarized-pdf-text',
			body: { id: 'resource-id', output_type: 'file', output: 'summary' },
		};
		await preSend?.call(
			{
				getNodeParameter: (name: string, fallback: unknown) => {
					expect(name).toBe('options.outputType');
					expect(fallback).toBe('json');
					return 'file';
				},
			} as unknown as IExecuteSingleFunctions,
			fileRequest,
		);
		expect(fileRequest.body).toEqual({
			id: 'resource-id',
			output_type: 'file',
			output: 'summary',
		});

		const jsonRequest: IHttpRequestOptions = {
			url: '/summarized-pdf-text',
			body: { id: 'resource-id', output_type: 'json', output: 'stale-name' },
		};
		await preSend?.call(
			{ getNodeParameter: () => 'json' } as unknown as IExecuteSingleFunctions,
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
		const includeRequest: IHttpRequestOptions = { url: '/summarized-pdf-text' };
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
		const responseRequest: IHttpRequestOptions = {
			url: '/summarized-pdf-text',
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

	it('exposes exactly the JSON ID branch and declared optional properties', () => {
		const publicDefinition = JSON.stringify(summarizeDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = summarizeDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'output',
			'output_format',
			'output_type',
			'pages',
			'summary_format',
			'target_word_count',
		]);
	});
});
