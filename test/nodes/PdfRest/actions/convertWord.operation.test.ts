import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertWordDescription,
	convertWordOperation,
} from '../../../../nodes/PdfRest/actions/convertWord.operation';

function getOptionalField(name: string) {
	return convertWordDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

describe('Convert PDF to Word operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertWordOperation).toMatchObject({
			name: 'Convert PDF to Microsoft Word',
			value: 'convertWord',
			action: 'Convert · PDF to Word (DOCX)',
			routing: {
				request: {
					method: 'POST',
					url: '/word',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID with exact JSON body routing', () => {
		expect(convertWordDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertWord'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups the optional output and headers alphabetically', () => {
		const optionalFields = convertWordDescription[1];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertWord'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('maps the optional output filename and enforces its minimum length', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const invalid: IHttpRequestOptions = { url: '/word', body: { output: '' } };
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(
				{
					getNode: () => ({
						name: 'Convert PDF to Word',
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

		const request: IHttpRequestOptions = { url: '/word' };
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

	it('inherits Response-Type from the path and omits it by default', async () => {
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
			url: '/word',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/word' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch without binary input', () => {
		const publicDefinition = JSON.stringify(convertWordDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = convertWordDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output']);
	});
});
