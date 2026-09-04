import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertJpgDescription,
	convertJpgOperation,
} from '../../../../nodes/PdfRest/actions/convertJpg.operation';

function getOptionalField(name: string) {
	return convertJpgDescription[1].options?.find((field) => field.name === name);
}

function createContext(): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Convert PDF to JPEG Images',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('Convert PDF to JPEG operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertJpgOperation).toMatchObject({
			name: 'Convert PDF to JPEG Images',
			value: 'convertJpg',
			action: 'Convert · PDF to JPG Images (JPEG)',
			routing: {
				request: {
					method: 'POST',
					url: '/jpg',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(convertJpgDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertJpg'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('declares every optional field alphabetically', () => {
		const optionalFields = convertJpgDescription[1];

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertJpg'] } },
		});
		expect(optionalFields.options?.map((field) => field.name)).toEqual([
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
	});

	it('maps all JPEG color models and quality constraints', () => {
		expect(getOptionalField('colorModel')).toMatchObject({
			displayName: 'Color Model',
			type: 'options',
			options: [
				{ name: 'RGB', value: 'rgb' },
				{ name: 'CMYK', value: 'cmyk' },
				{ name: 'Grayscale', value: 'gray' },
			],
			default: 'rgb',
			routing: { send: { type: 'body', property: 'color_model' } },
		});
		expect(getOptionalField('jpegQuality')).toMatchObject({
			displayName: 'JPEG Quality',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 0 },
			default: 75,
			routing: { send: { type: 'body', property: 'jpeg_quality' } },
		});
	});

	it('maps page selection and resolution with exact defaults and constraints', () => {
		expect(getOptionalField('pages')).toMatchObject({
			displayName: 'Pages',
			type: 'string',
			default: '1-last',
			placeholder: 'e.g. 1,2,5-10,12-last',
			routing: { send: { type: 'body', property: 'pages' } },
		});
		expect(getOptionalField('resolution')).toMatchObject({
			displayName: 'Resolution',
			type: 'number',
			typeOptions: { minValue: 12, maxValue: 2400, numberPrecision: 0 },
			default: 300,
			routing: { send: { type: 'body', property: 'resolution' } },
		});
	});

	it('maps optional non-empty output and password fields with validation hooks', async () => {
		for (const [name, bodyProperty] of [
			['output', 'output'],
			['password', 'password'],
		] as const) {
			const field = getOptionalField(name);
			expect(field).toMatchObject({
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: bodyProperty } },
			});
			expect(field?.routing?.send?.preSend).toHaveLength(1);
			if (name === 'password') {
				expect(field?.typeOptions).toMatchObject({ password: true });
			}

			const preSend = field?.routing?.send?.preSend?.[0];
			const omitted: IHttpRequestOptions = { url: '/jpg', body: { id: 'resource-id' } };
			await expect(preSend?.call(createContext(), omitted)).resolves.toBe(omitted);

			const valid: IHttpRequestOptions = {
				url: '/jpg',
				body: { id: 'resource-id', [bodyProperty]: 'value' },
			};
			await expect(preSend?.call(createContext(), valid)).resolves.toBe(valid);

			const invalid: IHttpRequestOptions = {
				url: '/jpg',
				body: { id: 'resource-id', [bodyProperty]: '' },
			};
			await expect(preSend?.call(createContext(), invalid)).rejects.toThrow(
				'has an invalid value',
			);
		}
	});

	it('maps and validates every smoothing branch', async () => {
		const smoothing = getOptionalField('smoothing');
		const preSend = smoothing?.routing?.send?.preSend?.[0];

		expect(smoothing).toMatchObject({
			displayName: 'Smoothing',
			type: 'string',
			default: 'none',
			routing: { send: { type: 'body', property: 'smoothing' } },
		});
		expect(preSend).toBeDefined();

		for (const value of ['none', 'all', 'text', 'line', 'image', 'text,line,image']) {
			const request: IHttpRequestOptions = { url: '/jpg', body: { smoothing: value } };
			await expect(preSend?.call(createContext(), request)).resolves.toBe(request);
		}

		const invalid: IHttpRequestOptions = { url: '/jpg', body: { smoothing: 'text,all' } };
		await expect(preSend?.call(createContext(), invalid)).rejects.toThrow(
			'Smoothing has an invalid value',
		);
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/jpg' };

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
			url: '/jpg',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/jpg' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared body properties', () => {
		const publicDefinition = JSON.stringify(convertJpgDescription);
		const bodyProperties = convertJpgDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(convertJpgDescription.map((field) => field.name)).toEqual([
			'resourceId',
			'options',
		]);
		expect(bodyProperties).toEqual([
			'id',
			'color_model',
			'jpeg_quality',
			'output',
			'pages',
			'password',
			'resolution',
			'smoothing',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
