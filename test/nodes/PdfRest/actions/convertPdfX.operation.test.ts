import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertPdfXDescription,
	convertPdfXOperation,
} from '../../../../nodes/PdfRest/actions/convertPdfX.operation';

function getOptionalField(name: string) {
	return convertPdfXDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

describe('Convert PDF to PDF/X operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertPdfXOperation).toMatchObject({
			name: 'Convert PDF to PDF/X',
			value: 'convertPdfX',
			action: 'Convert · PDF to PDF/X (Print)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdfx',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required resource ID and PDF/X version', () => {
		expect(convertPdfXDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertPdfX'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(convertPdfXDescription[1]).toMatchObject({
			displayName: 'PDF/X Version',
			name: 'pdfXVersion',
			type: 'options',
			options: [
				{ name: 'PDF/X-1a', value: 'PDF/X-1a' },
				{ name: 'PDF/X-3', value: 'PDF/X-3' },
				{ name: 'PDF/X-4', value: 'PDF/X-4' },
				{ name: 'PDF/X-6', value: 'PDF/X-6' },
			],
			default: 'PDF/X-1a',
			required: true,
			displayOptions: { show: { operation: ['convertPdfX'] } },
			routing: { send: { type: 'body', property: 'output_type' } },
		});
	});

	it('groups optional fields alphabetically', () => {
		const optionalFields = convertPdfXDescription[2];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertPdfX'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('maps and validates the optional output filename minimum length', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});

		const omitted: IHttpRequestOptions = { url: '/pdfx', body: { id: 'resource-id' } };
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(
				{
					getNode: () => ({
						name: 'Convert PDF to PDF/X',
						type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
						typeVersion: 1,
						position: [0, 0],
						parameters: {},
					}),
				} as unknown as IExecuteSingleFunctions,
				omitted,
			),
		).resolves.toBe(omitted);

		const invalid: IHttpRequestOptions = { url: '/pdfx', body: { output: '' } };
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(
				{
					getNode: () => ({
						name: 'Convert PDF to PDF/X',
						type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
						typeVersion: 1,
						position: [0, 0],
						parameters: {},
					}),
				} as unknown as IExecuteSingleFunctions,
				invalid,
			),
		).rejects.toThrow('Output File Name must contain at least one character.');
	});

	it('routes Include-File-Info using its declared false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			name: 'includeFileInfo',
			type: 'boolean',
			default: false,
		});

		const request: IHttpRequestOptions = { url: '/pdfx' };
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

	it('inherits Response-Type and omits it by default', async () => {
		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({
			displayName: 'Response Type',
			name: 'responseType',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
		});

		const synchronousRequest: IHttpRequestOptions = {
			url: '/pdfx',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/pdfx' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch without binary input', () => {
		const publicDefinition = JSON.stringify(convertPdfXDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = convertPdfXDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output_type', 'output']);
	});
});
