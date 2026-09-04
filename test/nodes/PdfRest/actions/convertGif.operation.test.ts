import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertGifDescription,
	convertGifOperation,
} from '../../../../nodes/PdfRest/actions/convertGif.operation';

describe('Convert PDF to GIF operation', () => {
	const optionalFields = convertGifDescription.find((field) => field.name === 'options');
	const fields = optionalFields?.options ?? [];
	const getField = (name: string) => fields.find((field) => field.name === name);

	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertGifOperation).toMatchObject({
			name: 'Convert PDF to GIF Images',
			value: 'convertGif',
			action: 'Convert · PDF to GIF Images',
			routing: {
				request: {
					method: 'POST',
					url: '/gif',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires and routes the public resource ID input', () => {
		const resourceId = convertGifDescription.find((field) => field.name === 'resourceId');

		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertGif'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('declares every optional field alphabetically with exact routing', () => {
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['convertGif'] } },
		});
		expect(fields.map((field) => field.name)).toEqual([
			'colorModel',
			'includeFileInfo',
			'output',
			'pages',
			'password',
			'resolution',
			'responseType',
			'smoothing',
		]);

		expect(getField('colorModel')).toMatchObject({
			displayName: 'Color Model',
			type: 'options',
			options: [
				{ name: 'RGB', value: 'rgb' },
				{ name: 'Grayscale', value: 'gray' },
			],
			default: 'rgb',
			routing: { send: { type: 'body', property: 'color_model' } },
		});
		expect(getField('output')).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(getField('pages')).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			placeholder: 'e.g. 1,2,5-10,12-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
		expect(getField('password')).toMatchObject({
			displayName: 'Password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			routing: { send: { type: 'body', property: 'password' } },
		});
		expect(getField('resolution')).toMatchObject({
			displayName: 'Resolution',
			type: 'number',
			typeOptions: { minValue: 12, maxValue: 2400, numberPrecision: 0 },
			default: 300,
			routing: { send: { type: 'body', property: 'resolution' } },
		});
		expect(getField('smoothing')).toMatchObject({
			displayName: 'Smoothing',
			type: 'string',
			default: 'none',
			placeholder: 'e.g. text,line,image',
			routing: { send: { type: 'body', property: 'smoothing' } },
		});
	});

	it('validates optional non-empty strings and the smoothing pattern', async () => {
		const context = {
			getNode: () => ({
				name: 'Convert PDF to GIF',
				type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			}),
		} as unknown as IExecuteSingleFunctions;

		for (const name of ['output', 'password'] as const) {
			const preSend = getField(name)?.routing?.send?.preSend?.[0];
			const omitted: IHttpRequestOptions = { url: '/gif', body: { id: 'resource-id' } };
			await expect(preSend?.call(context, omitted)).resolves.toBe(omitted);

			const invalid: IHttpRequestOptions = {
				url: '/gif',
				body: { id: 'resource-id', [name]: '' },
			};
			await expect(preSend?.call(context, invalid)).rejects.toThrow('has an invalid value');
		}

		const smoothingPreSend = getField('smoothing')?.routing?.send?.preSend?.[0];
		for (const smoothing of ['none', 'all', 'text', 'line,image', 'text,line,image']) {
			const valid: IHttpRequestOptions = { url: '/gif', body: { smoothing } };
			await expect(smoothingPreSend?.call(context, valid)).resolves.toBe(valid);
		}
		const invalidSmoothing: IHttpRequestOptions = {
			url: '/gif',
			body: { smoothing: 'text,all' },
		};
		await expect(smoothingPreSend?.call(context, invalidSmoothing)).rejects.toThrow(
			'Smoothing has an invalid value',
		);
	});

	it('routes Include-File-Info and omits Response-Type by default', async () => {
		const includeFileInfo = getField('includeFileInfo');
		const responseType = getField('responseType');
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

		const includeRequest: IHttpRequestOptions = { url: '/gif' };
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
			url: '/gif',
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

	it('exposes only the ID branch and no public binary-file fields', () => {
		const publicDefinition = JSON.stringify(convertGifDescription);

		expect(convertGifDescription.map((field) => field.name)).toEqual(['resourceId', 'options']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
