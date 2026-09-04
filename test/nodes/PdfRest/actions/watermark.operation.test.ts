import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	watermarkDescription,
	watermarkOperation,
} from '../../../../nodes/PdfRest/actions/watermark.operation';

function getField(name: string) {
	return watermarkDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Watermark PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Watermark PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(watermarkOperation).toMatchObject({
			name: 'Add Watermark to PDF',
			value: 'watermark',
			action: 'Secure · Add Watermark to PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/watermarked-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires a PDF resource ID and a routing-free watermark type', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['watermark'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});

		const watermarkType = getField('watermarkType');
		expect(watermarkType).toMatchObject({
			displayName: 'Watermark Type',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Image (PDF File)', value: 'pdfResource' },
				{ name: 'Text (RGB)', value: 'rgbText' },
				{ name: 'Text (CMYK)', value: 'cmykText' },
			],
			default: 'rgbText',
			required: true,
			displayOptions: { show: { operation: ['watermark'] } },
			routing: { send: {} },
		});
		expect(watermarkType?.routing?.send?.type).toBeUndefined();
		expect(watermarkType?.routing?.send?.property).toBeUndefined();
		expect(watermarkType?.routing?.send?.preSend).toHaveLength(1);
	});

	it('maps the required properties for all three mutually exclusive branches', () => {
		expect(getField('watermarkText')).toMatchObject({
			displayName: 'Watermark Text',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: { operation: ['watermark'], watermarkType: ['cmykText', 'rgbText'] },
			},
			routing: { send: { type: 'body', property: 'watermark_text' } },
		});
		for (const [name, displayName, defaultValue] of [
			['cmykCyan', 'Watermark Text Cyan (C)', 0],
			['cmykMagenta', 'Watermark Text Magenta (M)', 0],
			['cmykYellow', 'Watermark Text Yellow (Y)', 0],
			['cmykBlack', 'Watermark Text Black (K)', 100],
		] as const) {
			expect(getField(name)).toMatchObject({
				displayName,
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 100, numberPrecision: 0 },
				default: defaultValue,
				required: true,
				displayOptions: {
					show: { operation: ['watermark'], watermarkType: ['cmykText'] },
				},
			});
			expect(getField(name)?.routing).toBeUndefined();
		}
		expect(getField('textColorRgb')).toMatchObject({
			displayName: 'RGB Text Color',
			type: 'color',
			default: '#000000',
			displayOptions: {
				show: { operation: ['watermark'], watermarkType: ['rgbText'] },
			},
			routing: { send: { type: 'body', property: 'text_color_rgb' } },
		});
		expect(getField('textColorRgb')?.routing?.send?.preSend).toHaveLength(1);
		expect(getField('watermarkFileId')).toMatchObject({
			displayName: 'Watermark PDF Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: { operation: ['watermark'], watermarkType: ['pdfResource'] },
			},
			routing: { send: { type: 'body', property: 'watermark_file_id' } },
		});
	});

	it('keeps only the selected RGB text branch', async () => {
		const request: IHttpRequestOptions = {
			url: '/watermarked-pdf',
			body: {
				id: 'pdf-id',
				watermark_text: 'Draft',
				text_color_rgb: '255,0,0',
				text_color_cmyk: '0,100,100,0',
				font: 'Arial',
				text_size: 72,
				watermark_file_id: 'stale-watermark-id',
				watermark_file_scale: 0.5,
			},
		};
		const preSend = getField('watermarkType')?.routing?.send?.preSend?.[0];
		await preSend?.call(
			{
				...executionContext,
				getNodeParameter: (name: string, fallback: unknown) => {
					expect(name).toBe('watermarkType');
					expect(fallback).toBe('rgbText');
					return 'rgbText';
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.body).toEqual({
			id: 'pdf-id',
			watermark_text: 'Draft',
			text_color_rgb: '255,0,0',
			font: 'Arial',
			text_size: 72,
		});
	});

	it('keeps only the selected CMYK text branch', async () => {
		const request: IHttpRequestOptions = {
			url: '/watermarked-pdf',
			body: {
				id: 'pdf-id',
				watermark_text: 'Draft',
				text_color_rgb: '255,0,0',
				text_color_cmyk: '0,100,100,0',
				font: 'Arial',
				text_size: 72,
				watermark_file_id: 'stale-watermark-id',
				watermark_file_scale: 0.5,
			},
		};
		await getField('watermarkType')?.routing?.send?.preSend?.[0]?.call(
			{
				...executionContext,
				getNodeParameter: (name: string) =>
					({
						watermarkType: 'cmykText',
						cmykCyan: 10,
						cmykMagenta: 20,
						cmykYellow: 30,
						cmykBlack: 40,
					} as Record<string, unknown>)[name],
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.body).toEqual({
			id: 'pdf-id',
			watermark_text: 'Draft',
			text_color_cmyk: '10,20,30,40',
			font: 'Arial',
			text_size: 72,
		});
	});

	it('keeps only the selected PDF-resource branch', async () => {
		const request: IHttpRequestOptions = {
			url: '/watermarked-pdf',
			body: {
				id: 'pdf-id',
				watermark_text: 'stale text',
				text_color_rgb: '255,0,0',
				text_color_cmyk: '0,100,100,0',
				font: 'Arial',
				text_size: 72,
				watermark_file_id: 'watermark-id',
				watermark_file_scale: 0.75,
			},
		};
		await getField('watermarkType')?.routing?.send?.preSend?.[0]?.call(
			{
				...executionContext,
				getNodeParameter: () => 'pdfResource',
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.body).toEqual({
			id: 'pdf-id',
			watermark_file_id: 'watermark-id',
			watermark_file_scale: 0.75,
		});
	});

	it('validates text branches, CMYK channels, and the selector value', async () => {
		const preSend = getField('watermarkType')?.routing?.send?.preSend?.[0];
		await expect(
			preSend?.call(
				{
					...executionContext,
					getNodeParameter: () => 'rgbText',
				} as unknown as IExecuteSingleFunctions,
				{ url: '/watermarked-pdf', body: { id: 'pdf-id' } },
			),
		).rejects.toThrow('Watermark Text is required');

		await expect(
			preSend?.call(
				{
					...executionContext,
					getNodeParameter: (name: string) => (name === 'watermarkType' ? 'cmykText' : 101),
				} as unknown as IExecuteSingleFunctions,
				{ url: '/watermarked-pdf', body: { id: 'pdf-id', watermark_text: 'Draft' } },
			),
		).rejects.toThrow(
			'Watermark Text Cyan (C) must be an integer from 0 through 100.',
		);

		await expect(
			preSend?.call(
				{
					...executionContext,
					getNodeParameter: () => 'invalid',
				} as unknown as IExecuteSingleFunctions,
				{ url: '/watermarked-pdf', body: { id: 'pdf-id' } },
			),
		).rejects.toThrow('Watermark Type has an invalid value');
	});

	it('declares the complete alphabetized optional field collection', () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['watermark'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'behindPage',
			'font',
			'horizontalAlignment',
			'includeFileInfo',
			'opacity',
			'output',
			'pages',
			'responseType',
			'rotation',
			'textSize',
			'verticalAlignment',
			'watermarkFileScale',
			'x',
			'y',
		]);
	});

	it('maps branch-specific optional defaults, constraints, and visibility', () => {
		expect(getOptionalField('font')).toMatchObject({
			type: 'string',
			default: 'Arial',
			displayOptions: { show: { watermarkType: ['cmykText', 'rgbText'] } },
			routing: { send: { type: 'body', property: 'font' } },
		});
		expect(getOptionalField('textSize')).toMatchObject({
			type: 'number',
			typeOptions: { minValue: 5, maxValue: 100 },
			default: 72,
			displayOptions: { show: { watermarkType: ['cmykText', 'rgbText'] } },
			routing: { send: { type: 'body', property: 'text_size' } },
		});
		expect(getOptionalField('watermarkFileScale')).toMatchObject({
			type: 'number',
			typeOptions: { minValue: 0 },
			default: 0.5,
			displayOptions: { show: { watermarkType: ['pdfResource'] } },
			routing: { send: { type: 'body', property: 'watermark_file_scale' } },
		});
	});

	it('converts the selected RGB text color from hex to pdfRest channels', async () => {
		const request: IHttpRequestOptions = {
			url: '/watermarked-pdf',
			body: { text_color_rgb: '#1a70FF' },
		};
		const preSend = getField('textColorRgb')?.routing?.send?.preSend?.[0];

		await expect(preSend?.call(executionContext, request)).resolves.toBe(request);
		expect(request.body).toEqual({ text_color_rgb: '26,112,255' });
	});

	it('maps common option defaults, enums, constraints, and exact body properties', () => {
		expect(getOptionalField('behindPage')).toMatchObject({
			type: 'options',
			options: [
				{ name: 'False', value: 'false' },
				{ name: 'True', value: 'true' },
			],
			default: 'false',
			routing: { send: { type: 'body', property: 'behind_page' } },
		});
		expect(getOptionalField('horizontalAlignment')).toMatchObject({
			options: [
				{ name: 'Center', value: 'center' },
				{ name: 'Left', value: 'left' },
				{ name: 'Right', value: 'right' },
			],
			default: 'center',
			routing: { send: { type: 'body', property: 'horizontal_alignment' } },
		});
		expect(getOptionalField('verticalAlignment')).toMatchObject({
			options: [
				{ name: 'Bottom', value: 'bottom' },
				{ name: 'Center', value: 'center' },
				{ name: 'Top', value: 'top' },
			],
			default: 'center',
			routing: { send: { type: 'body', property: 'vertical_alignment' } },
		});
		expect(getOptionalField('opacity')).toMatchObject({
			typeOptions: { minValue: 0, maxValue: 1 },
			default: 0.5,
			routing: { send: { type: 'body', property: 'opacity' } },
		});
		expect(getOptionalField('rotation')).toMatchObject({
			typeOptions: { numberPrecision: 0 },
			default: 0,
			routing: { send: { type: 'body', property: 'rotation' } },
		});
		for (const name of ['x', 'y']) {
			expect(getOptionalField(name)).toMatchObject({
				typeOptions: { numberPrecision: 0 },
				default: 0,
				routing: { send: { type: 'body', property: name } },
			});
		}
	});

	it('validates optional strings without sending omitted collection values', async () => {
		const pages = getOptionalField('pages');
		expect(pages).toMatchObject({
			type: 'string',
			default: '1-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});

		for (const [field, property] of [
			[pages, 'pages'],
			[output, 'output'],
		] as const) {
			const omitted: IHttpRequestOptions = { url: '/watermarked-pdf', body: {} };
			await expect(
				field?.routing?.send?.preSend?.[0]?.call(executionContext, omitted),
			).resolves.toBe(omitted);
			const invalid: IHttpRequestOptions = {
				url: '/watermarked-pdf',
				body: { [property]: '' },
			};
			await expect(
				field?.routing?.send?.preSend?.[0]?.call(executionContext, invalid),
			).rejects.toThrow('must contain at least one character');
		}
	});

	it('exposes inherited headers and omits Response-Type by default', async () => {
		expect(getOptionalField('includeFileInfo')).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			default: '',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
		});

		const request: IHttpRequestOptions = {
			url: '/watermarked-pdf',
			headers: { 'Response-Type': 'requestId', Existing: 'value' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{
				...executionContext,
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.headers).toEqual({ Existing: 'value' });
	});

	it('does not expose multipart binary inputs', () => {
		const fields = [...watermarkDescription, ...(getField('options')?.options ?? [])];
		expect(fields.some(({ name }) => name === 'inputFile')).toBe(false);
		expect(fields.some(({ name }) => name === 'inputFileDataFieldName')).toBe(false);
		expect(fields.some(({ name }) => name === 'watermarkFile')).toBe(false);
		expect(fields.some(({ type }) => type === 'binary')).toBe(false);
	});
});
