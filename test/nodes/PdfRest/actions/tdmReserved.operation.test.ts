import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	tdmReservedDescription,
	tdmReservedOperation,
} from '../../../../nodes/PdfRest/actions/tdmReserved.operation';

function getField(name: string) {
	return tdmReservedDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Reserve PDF for TDM',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Reserve PDF for TDM operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(tdmReservedOperation).toMatchObject({
			name: 'Apply TDM Reservation Policy to PDF',
			value: 'tdmReserved',
			action: 'Secure · TDM Reserve PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/tdm-reserved-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('maps the required JSON resource ID and policy example', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['tdmReserved'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(getField('policy')).toMatchObject({
			displayName: 'Policy',
			type: 'string',
			default: 'https://example.com/tdm-policy',
			required: true,
			displayOptions: { show: { operation: ['tdmReserved'] } },
			routing: { send: { type: 'body', property: 'policy' } },
		});
	});

	it('enforces the policy minLength constraint while accepting its OpenAPI example', async () => {
		const policy = getField('policy');
		const preSend = policy?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();

		const valid: IHttpRequestOptions = {
			url: '/tdm-reserved-pdf',
			body: { id: 'pdf-id', policy: 'https://example.com/tdm-policy' },
		};
		await expect(preSend?.call(executionContext, valid)).resolves.toBe(valid);

		const invalid: IHttpRequestOptions = {
			url: '/tdm-reserved-pdf',
			body: { id: 'pdf-id', policy: '' },
		};
		await expect(preSend?.call(executionContext, invalid)).rejects.toThrow(
			'Policy must contain at least one character.',
		);
	});

	it('declares alphabetized optional fields and validates the output filename', async () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['tdmReserved'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);

		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const omitted: IHttpRequestOptions = { url: '/tdm-reserved-pdf', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(executionContext, omitted)).resolves.toBe(
			omitted,
		);
		const invalid: IHttpRequestOptions = {
			url: '/tdm-reserved-pdf',
			body: { output: '' },
		};
		await expect(output?.routing?.send?.preSend?.[0]?.call(executionContext, invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('routes Include-File-Info using its default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});

		const request: IHttpRequestOptions = { url: '/tdm-reserved-pdf' };
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

	it('exposes Response-Type but omits its header by default', async () => {
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
			url: '/tdm-reserved-pdf',
			headers: { Accept: 'application/json', 'Response-Type': 'requestId' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes only the exact JSON body properties and no binary input', () => {
		const publicDefinition = JSON.stringify(tdmReservedDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binary');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = tdmReservedDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'policy', 'output']);
	});
});
