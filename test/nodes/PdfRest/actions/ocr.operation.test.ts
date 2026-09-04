import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { ocrDescription, ocrOperation } from '../../../../nodes/PdfRest/actions/ocr.operation';

function getOptionalField(name: string) {
	return ocrDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

describe('OCR PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(ocrOperation).toMatchObject({
			name: 'OCR PDF to Add Searchable Text',
			value: 'ocr',
			action: 'Extract · OCR PDF (Make Searchable)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-ocr-text',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(ocrDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['ocr'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional property and header alphabetically', () => {
		const optionalFields = ocrDescription[1];

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['ocr'] } },
		});
		expect(optionalFields.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'languages',
			'output',
			'responseType',
		]);
	});

	it('maps every OCR language and serializes selections to the declared string format', () => {
		const languages = getOptionalField('languages');

		expect(languages).toMatchObject({
			displayName: 'Languages',
			type: 'multiOptions',
			options: [
				{ name: 'Chinese Simplified', value: 'ChineseSimplified' },
				{ name: 'Chinese Traditional', value: 'ChineseTraditional' },
				{ name: 'Dutch', value: 'Dutch' },
				{ name: 'English', value: 'English' },
				{ name: 'French', value: 'French' },
				{ name: 'German', value: 'German' },
				{ name: 'Italian', value: 'Italian' },
				{ name: 'Japanese', value: 'Japanese' },
				{ name: 'Korean', value: 'Korean' },
				{ name: 'Portuguese', value: 'Portuguese' },
				{ name: 'Spanish', value: 'Spanish' },
			],
			default: ['English'],
			routing: {
				send: {
					type: 'body',
					property: 'languages',
					value: "={{ $value.join(',') }}",
				},
			},
		});
		expect(languages?.description).toContain('reduce performance');
	});

	it('maps the optional output filename and enforces its minimum length', async () => {
		const output = getOptionalField('output');

		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.description).toContain('without an extension');
		expect(output?.routing?.send?.preSend).toHaveLength(1);

		const preSend = output?.routing?.send?.preSend?.[0];
		const omittedRequest: IHttpRequestOptions = {
			url: '/pdf-with-ocr-text',
			body: { id: 'resource-id' },
		};
		await expect(
			preSend?.call({} as IExecuteSingleFunctions, omittedRequest),
		).resolves.toBe(omittedRequest);

		const validRequest: IHttpRequestOptions = {
			url: '/pdf-with-ocr-text',
			body: { id: 'resource-id', output: 'searchable' },
		};
		await expect(
			preSend?.call({} as IExecuteSingleFunctions, validRequest),
		).resolves.toBe(validRequest);

		const invalidRequest: IHttpRequestOptions = {
			url: '/pdf-with-ocr-text',
			body: { id: 'resource-id', output: '' },
		};
		await expect(
			preSend?.call(
				{
					getNode: () => ({
						name: 'OCR PDF',
						type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
						typeVersion: 1,
						position: [0, 0],
						parameters: {},
					}),
				} as unknown as IExecuteSingleFunctions,
				invalidRequest,
			),
		).rejects.toThrow('Output File Name must contain at least one character.');
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/pdf-with-ocr-text' };

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

	it('omits Response-Type by default and sends requestId when selected', async () => {
		const responseType = getOptionalField('responseType');

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

		const preSend = responseType?.routing?.send?.preSend?.[0];
		const synchronousRequest: IHttpRequestOptions = {
			url: '/pdf-with-ocr-text',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/pdf-with-ocr-text' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes only the JSON ID branch and no binary-file fields', () => {
		const publicDefinition = JSON.stringify(ocrDescription);
		const bodyProperties = ocrDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(ocrDescription.map((field) => field.name)).toEqual(['resourceId', 'options']);
		expect(bodyProperties).toEqual(['id', 'languages', 'output']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
