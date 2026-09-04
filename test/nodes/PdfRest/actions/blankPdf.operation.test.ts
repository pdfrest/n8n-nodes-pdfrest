import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	blankPdfDescription,
	blankPdfOperation,
} from '../../../../nodes/PdfRest/actions/blankPdf.operation';

function getField(name: string) {
	return blankPdfDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Create Blank PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Create Blank PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(blankPdfOperation).toMatchObject({
			name: 'Create Blank PDF',
			value: 'blankPdf',
			action: 'Modify · Create Blank PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/blank-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('declares the required page count and exact page-size enum', () => {
		expect(getField('pageCount')).toMatchObject({
			displayName: 'Page Count',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 1000, numberPrecision: 0 },
			default: 1,
			required: true,
			displayOptions: { show: { operation: ['blankPdf'] } },
			routing: { send: { type: 'body', property: 'page_count' } },
		});
		expect(getField('pageSize')).toMatchObject({
			displayName: 'Page Size',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'A3', value: 'A3' },
				{ name: 'A4', value: 'A4' },
				{ name: 'A5', value: 'A5' },
				{ name: 'Custom', value: 'custom' },
				{ name: 'Ledger', value: 'ledger' },
				{ name: 'Legal', value: 'legal' },
				{ name: 'Letter', value: 'letter' },
			],
			default: 'letter',
			required: true,
			routing: { send: { type: 'body', property: 'page_size' } },
		});
		expect(getField('pageSize')?.routing?.send?.preSend).toHaveLength(1);
	});

	it('shows and routes orientation only for every standard page size', () => {
		expect(getField('pageOrientation')).toMatchObject({
			displayName: 'Page Orientation',
			type: 'options',
			options: [
				{ name: 'Landscape', value: 'landscape' },
				{ name: 'Portrait', value: 'portrait' },
			],
			default: 'portrait',
			required: true,
			displayOptions: {
				show: {
					operation: ['blankPdf'],
					pageSize: ['letter', 'legal', 'ledger', 'A3', 'A4', 'A5'],
				},
			},
			routing: { send: { type: 'body', property: 'page_orientation' } },
		});
	});

	it('shows custom dimensions only for the custom branch', () => {
		for (const [name, property, defaultValue] of [
			['customHeight', 'custom_height', 792],
			['customWidth', 'custom_width', 612],
		] as const) {
			expect(getField(name)).toMatchObject({
				type: 'number',
				typeOptions: { minValue: 0 },
				default: defaultValue,
				required: true,
				displayOptions: { show: { operation: ['blankPdf'], pageSize: ['custom'] } },
				routing: { send: { type: 'body', property } },
			});
		}
	});

	it('keeps only the standard oneOf branch and accepts the initial defaults', async () => {
		const request: IHttpRequestOptions = {
			url: '/blank-pdf',
			body: {
				page_count: 1,
				page_size: 'letter',
				page_orientation: 'portrait',
				custom_height: 0,
				custom_width: 0,
			},
		};
		await getField('pageSize')?.routing?.send?.preSend?.[0]?.call(
			{
				...executionContext,
				getNodeParameter: (name: string, fallback: unknown) => {
					expect(name).toBe('pageSize');
					expect(fallback).toBe('letter');
					return 'letter';
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.body).toEqual({
			page_count: 1,
			page_size: 'letter',
			page_orientation: 'portrait',
		});
	});

	it('keeps only the custom oneOf branch', async () => {
		const request: IHttpRequestOptions = {
			url: '/blank-pdf',
			body: {
				page_count: 2,
				page_size: 'custom',
				page_orientation: 'landscape',
				custom_height: 792,
				custom_width: 612,
			},
		};
		await getField('pageSize')?.routing?.send?.preSend?.[0]?.call(
			{
				...executionContext,
				getNodeParameter: () => 'custom',
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.body).toEqual({
			page_count: 2,
			page_size: 'custom',
			custom_height: 792,
			custom_width: 612,
		});
	});

	it('validates page count and the active oneOf branch', async () => {
		const preSend = getField('pageSize')?.routing?.send?.preSend?.[0];
		for (const [pageSize, body, message] of [
			[
				'letter',
				{ page_count: 0, page_size: 'letter', page_orientation: 'portrait' },
				'Page Count',
			],
			['letter', { page_count: 1, page_size: 'letter' }, 'Page Orientation'],
			[
				'custom',
				{ page_count: 1, page_size: 'custom', custom_height: 0, custom_width: 612 },
				'Custom Height',
			],
			[
				'custom',
				{ page_count: 1, page_size: 'custom', custom_height: 792, custom_width: 0 },
				'Custom Width',
			],
			['unknown', { page_count: 1, page_size: 'unknown' }, 'Page Size'],
		] as const) {
			await expect(
				preSend?.call(
					{
						...executionContext,
						getNodeParameter: () => pageSize,
					} as unknown as IExecuteSingleFunctions,
					{ url: '/blank-pdf', body },
				),
			).rejects.toThrow(message);
		}
	});

	it('declares alphabetized optional output and inherited headers', async () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['blankPdf'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);

		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, {
				url: '/blank-pdf',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character.');

		expect(getOptionalField('includeFileInfo')).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		expect(getOptionalField('responseType')).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			default: '',
		});
	});

	it('routes Include-File-Info and omits Response-Type by default', async () => {
		const includeRequest: IHttpRequestOptions = { url: '/blank-pdf' };
		await getOptionalField('includeFileInfo')?.routing?.send?.preSend?.[0]?.call(
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
			url: '/blank-pdf',
			headers: { Accept: 'application/json', 'Response-Type': 'requestId' },
		};
		await getOptionalField('responseType')?.routing?.send?.preSend?.[0]?.call(
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

	it('has no input selector or binary-file field', () => {
		const publicDefinition = JSON.stringify(blankPdfDescription);
		expect(publicDefinition).not.toContain('resourceId');
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binary');

		const bodyProperties = blankPdfDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'page_count',
			'page_size',
			'page_orientation',
			'custom_height',
			'custom_width',
			'output',
		]);
	});
});
