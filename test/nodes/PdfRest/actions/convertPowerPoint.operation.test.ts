import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertPowerPointDescription,
	convertPowerPointOperation,
} from '../../../../nodes/PdfRest/actions/convertPowerPoint.operation';

function getOptionalField(name: string) {
	return convertPowerPointDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

describe('Convert PDF to PowerPoint operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertPowerPointOperation).toMatchObject({
			name: 'Convert PDF to Microsoft PowerPoint',
			value: 'convertPowerPoint',
			action: 'Convert · PDF to PowerPoint (PPTX)',
			routing: {
				request: {
					method: 'POST',
					url: '/powerpoint',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(convertPowerPointDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertPowerPoint'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional property and inherited header alphabetically', () => {
		const optionalFields = convertPowerPointDescription[1];

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['convertPowerPoint'] } },
		});
		expect(optionalFields.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('routes the optional output filename and enforces its minimum length', async () => {
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
			url: '/powerpoint',
			body: { id: 'resource-id' },
		};
		await expect(
			preSend?.call({} as IExecuteSingleFunctions, omittedRequest),
		).resolves.toBe(omittedRequest);

		const validRequest: IHttpRequestOptions = {
			url: '/powerpoint',
			body: { id: 'resource-id', output: 'presentation' },
		};
		await expect(
			preSend?.call({} as IExecuteSingleFunctions, validRequest),
		).resolves.toBe(validRequest);

		const invalidRequest: IHttpRequestOptions = {
			url: '/powerpoint',
			body: { id: 'resource-id', output: '' },
		};
		await expect(
			preSend?.call(
				{
					getNode: () => ({
						name: 'Convert PDF to PowerPoint',
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
		const request: IHttpRequestOptions = { url: '/powerpoint' };

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

	it('omits the inherited Response-Type by default and supports requestId', async () => {
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
			url: '/powerpoint',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/powerpoint' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes only the JSON ID branch and declared request properties', () => {
		const publicDefinition = JSON.stringify(convertPowerPointDescription);
		const bodyProperties = convertPowerPointDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(convertPowerPointDescription.map((field) => field.name)).toEqual([
			'resourceId',
			'options',
		]);
		expect(bodyProperties).toEqual(['id', 'output']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
