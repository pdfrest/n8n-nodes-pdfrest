import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertPngDescription,
	convertPngOperation,
} from '../../../../nodes/PdfRest/actions/convertPng.operation';

function getOptionalField(name: string) {
	return convertPngDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Convert PDF to PNG',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Convert PDF to PNG operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertPngOperation).toMatchObject({
			name: 'Convert PDF to PNG Images',
			value: 'convertPng',
			action: 'Convert · PDF to PNG Images',
			routing: {
				request: {
					method: 'POST',
					url: '/png',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID with exact body routing', () => {
		expect(convertPngDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertPng'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional property and header alphabetically', () => {
		const optionalFields = convertPngDescription[1];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertPng'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
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

	it('maps every enum, default, numeric constraint, and body property', () => {
		expect(getOptionalField('colorModel')).toMatchObject({
			displayName: 'Color Model',
			type: 'options',
			options: [
				{ name: 'RGB', value: 'rgb' },
				{ name: 'RGBA', value: 'rgba' },
				{ name: 'Grayscale', value: 'gray' },
			],
			default: 'rgb',
			routing: { send: { type: 'body', property: 'color_model' } },
		});
		expect(getOptionalField('pages')).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
		expect(getOptionalField('resolution')).toMatchObject({
			displayName: 'Resolution',
			type: 'number',
			typeOptions: { minValue: 12, maxValue: 2400, numberPrecision: 0 },
			default: 300,
			routing: { send: { type: 'body', property: 'resolution' } },
		});
		expect(getOptionalField('smoothing')).toMatchObject({
			displayName: 'Smoothing',
			type: 'string',
			default: 'none',
			routing: { send: { type: 'body', property: 'smoothing' } },
		});
		expect(getOptionalField('jpegQuality')).toBeUndefined();
	});

	it('maps and validates optional non-empty output and password values', async () => {
		for (const [name, displayName, bodyProperty] of [
			['output', 'Output File Name', 'output'],
			['password', 'Password', 'password'],
		] as const) {
			const field = getOptionalField(name);
			expect(field).toMatchObject({
				displayName,
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: bodyProperty } },
			});
			if (name === 'password') {
				expect(field?.typeOptions).toEqual({ password: true });
			}

			const preSend = field?.routing?.send?.preSend?.[0];
			expect(preSend).toBeDefined();
			const omitted: IHttpRequestOptions = { url: '/png', body: { id: 'resource-id' } };
			await expect(preSend?.call(executionContext, omitted)).resolves.toBe(omitted);

			const valid: IHttpRequestOptions = {
				url: '/png',
				body: { id: 'resource-id', [bodyProperty]: 'value' },
			};
			await expect(preSend?.call(executionContext, valid)).resolves.toBe(valid);

			const invalid: IHttpRequestOptions = {
				url: '/png',
				body: { id: 'resource-id', [bodyProperty]: '' },
			};
			await expect(preSend?.call(executionContext, invalid)).rejects.toThrow(
				`${displayName} has an invalid value`,
			);
		}
	});

	it('enforces every smoothing form declared by the pattern', async () => {
		const preSend = getOptionalField('smoothing')?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();
		for (const value of [
			'none',
			'all',
			'text',
			'line,image',
			'text,line,image',
			'image,text,image',
		]) {
			const request: IHttpRequestOptions = { url: '/png', body: { smoothing: value } };
			await expect(preSend?.call(executionContext, request)).resolves.toBe(request);
		}

		for (const value of ['', 'text,all', 'none,text', 'Text']) {
			const request: IHttpRequestOptions = { url: '/png', body: { smoothing: value } };
			await expect(preSend?.call(executionContext, request)).rejects.toThrow(
				'Smoothing has an invalid value',
			);
		}
	});

	it('routes both headers and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		const includeRequest: IHttpRequestOptions = { url: '/png' };
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
			url: '/png',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/png' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes every JSON property without public binary fields', () => {
		const publicDefinition = JSON.stringify(convertPngDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = convertPngDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'color_model',
			'output',
			'pages',
			'password',
			'resolution',
			'smoothing',
		]);
	});
});
