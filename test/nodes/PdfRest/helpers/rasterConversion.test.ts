import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { createRasterConversionDescription } from '../../../../nodes/PdfRest/helpers/rasterConversion';

const colorModels = [
	{ name: 'RGB', value: 'rgb' },
	{ name: 'Grayscale', value: 'gray' },
];

function createDescription(includeJpegQuality = false) {
	return createRasterConversionDescription({
		operation: 'convertImage',
		colorModels,
		includeJpegQuality,
	});
}

describe('raster conversion fields', () => {
	it('creates the required resource ID and alphabetized common fields', () => {
		const description = createDescription();
		const optionalFields = description[1];

		expect(description[0]).toMatchObject({
			displayName: 'Resource ID',
			required: true,
			displayOptions: { show: { operation: ['convertImage'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['convertImage'] } },
		});
		expect(optionalFields.options?.map((field) => field.name)).toEqual([
			'colorModel',
			'includeFileInfo',
			'output',
			'pages',
			'password',
			'resolution',
			'responseType',
			'smoothing',
		]);
	});

	it('maps common request properties with exact defaults and constraints', () => {
		const fields = createDescription()[1].options ?? [];
		const get = (name: string) => fields.find((field) => field.name === name);

		expect(get('colorModel')).toMatchObject({
			type: 'options',
			options: colorModels,
			default: 'rgb',
			routing: { send: { type: 'body', property: 'color_model' } },
		});
		expect(get('pages')).toMatchObject({
			default: '1-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
		expect(get('resolution')).toMatchObject({
			type: 'number',
			typeOptions: { minValue: 12, maxValue: 2400, numberPrecision: 0 },
			default: 300,
			routing: { send: { type: 'body', property: 'resolution' } },
		});
		expect(get('smoothing')).toMatchObject({
			default: 'none',
			routing: { send: { type: 'body', property: 'smoothing' } },
		});
	});

	it('adds the JPEG-only quality field in alphabetical order', () => {
		const fields = createDescription(true)[1].options ?? [];
		expect(fields.map((field) => field.name)).toEqual([
			'colorModel',
			'includeFileInfo',
			'jpegQuality',
			'output',
			'pages',
			'password',
			'resolution',
			'responseType',
			'smoothing',
		]);
		expect(fields.find((field) => field.name === 'jpegQuality')).toMatchObject({
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 0 },
			default: 75,
			routing: { send: { type: 'body', property: 'jpeg_quality' } },
		});
	});

	it('validates optional non-empty output and password values', async () => {
		const fields = createDescription()[1].options ?? [];
		const context = {
			getNode: () => ({
				name: 'Convert PDF to Image',
				type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			}),
		} as unknown as IExecuteSingleFunctions;

		for (const [name, bodyProperty] of [
			['output', 'output'],
			['password', 'password'],
		] as const) {
			const preSend = fields.find((field) => field.name === name)?.routing?.send?.preSend?.[0];
			const omitted: IHttpRequestOptions = { url: '/image', body: { id: 'resource-id' } };
			await expect(preSend?.call(context, omitted)).resolves.toBe(omitted);

			const invalid: IHttpRequestOptions = {
				url: '/image',
				body: { id: 'resource-id', [bodyProperty]: '' },
			};
			await expect(preSend?.call(context, invalid)).rejects.toThrow('has an invalid value');
		}
	});

	it('accepts every smoothing form allowed by the OpenAPI pattern', async () => {
		const smoothing = createDescription()[1].options?.find(
			(field) => field.name === 'smoothing',
		);
		const preSend = smoothing?.routing?.send?.preSend?.[0];
		const context = {
			getNode: () => ({
				name: 'Convert PDF to Image',
				type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			}),
		} as unknown as IExecuteSingleFunctions;

		for (const value of ['none', 'all', 'text', 'line,image', 'text,line,image']) {
			const request: IHttpRequestOptions = { url: '/image', body: { smoothing: value } };
			await expect(preSend?.call(context, request)).resolves.toBe(request);
		}

		const invalid: IHttpRequestOptions = { url: '/image', body: { smoothing: 'text,all' } };
		await expect(preSend?.call(context, invalid)).rejects.toThrow(
			'Smoothing has an invalid value',
		);
	});

	it('uses the shared header helpers and omits Response-Type by default', async () => {
		const fields = createDescription()[1].options ?? [];
		const include = fields.find((field) => field.name === 'includeFileInfo');
		const response = fields.find((field) => field.name === 'responseType');
		const includeRequest: IHttpRequestOptions = { url: '/image' };
		await include?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseRequest: IHttpRequestOptions = {
			url: '/image',
			headers: { 'Response-Type': '' },
		};
		await response?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({});
	});
});
