import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertPdfADescription,
	convertPdfAOperation,
} from '../../../../nodes/PdfRest/actions/convertPdfA.operation';

function getOptionalField(name: string) {
	return convertPdfADescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Convert PDF to PDF/A',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Convert PDF to PDF/A operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertPdfAOperation).toMatchObject({
			name: 'Convert PDF to PDF/A',
			value: 'convertPdfA',
			action: 'Convert · PDF to PDF/A (Archival)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdfa',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the resource ID and exact PDF/A version enum', () => {
		expect(convertPdfADescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertPdfA'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(convertPdfADescription[1]).toMatchObject({
			displayName: 'PDF/A Version',
			name: 'pdfAVersion',
			type: 'options',
			options: [
				{ name: 'PDF/A-1b', value: 'PDF/A-1b' },
				{ name: 'PDF/A-2b', value: 'PDF/A-2b' },
				{ name: 'PDF/A-2u', value: 'PDF/A-2u' },
				{ name: 'PDF/A-3b', value: 'PDF/A-3b' },
				{ name: 'PDF/A-3u', value: 'PDF/A-3u' },
			],
			default: 'PDF/A-1b',
			required: true,
			displayOptions: { show: { operation: ['convertPdfA'] } },
			routing: { send: { type: 'body', property: 'output_type' } },
		});
	});

	it('groups every optional field alphabetically', () => {
		const optionalFields = convertPdfADescription[2];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertPdfA'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'rasterizeIfErrorsEncountered',
			'responseType',
		]);
	});

	it('validates the optional output filename minLength constraint', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const preSend = output?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();

		const omitted: IHttpRequestOptions = {
			url: '/pdfa',
			body: { id: 'resource-id', output_type: 'PDF/A-1b' },
		};
		await expect(preSend?.call(executionContext, omitted)).resolves.toBe(omitted);
		const valid: IHttpRequestOptions = {
			url: '/pdfa',
			body: { id: 'resource-id', output: 'archive' },
		};
		await expect(preSend?.call(executionContext, valid)).resolves.toBe(valid);
		const invalid: IHttpRequestOptions = {
			url: '/pdfa',
			body: { id: 'resource-id', output: '' },
		};
		await expect(preSend?.call(executionContext, invalid)).rejects.toThrow(
			'Output File Name must contain at least one character',
		);
	});

	it('maps rasterization as the declared Off and On named options', () => {
		expect(getOptionalField('rasterizeIfErrorsEncountered')).toMatchObject({
			displayName: 'Rasterize If Errors Encountered',
			name: 'rasterizeIfErrorsEncountered',
			type: 'options',
			options: [
				{ name: 'Off', value: 'off' },
				{ name: 'On', value: 'on' },
			],
			default: 'off',
			routing: {
				send: { type: 'body', property: 'rasterize_if_errors_encountered' },
			},
		});
	});

	it('routes Include-File-Info using its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		const request: IHttpRequestOptions = { url: '/pdfa' };
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

	it('omits Response-Type by default and sends requestId explicitly', async () => {
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
			url: '/pdfa',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/pdfa' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes every JSON property without public binary input', () => {
		const publicDefinition = JSON.stringify(convertPdfADescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = convertPdfADescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'output_type',
			'output',
			'rasterize_if_errors_encountered',
		]);
	});
});
