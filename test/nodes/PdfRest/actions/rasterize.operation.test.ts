import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	rasterizeDescription,
	rasterizeOperation,
} from '../../../../nodes/PdfRest/actions/rasterize.operation';

function getField(name: string) {
	return rasterizeDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Rasterize PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Rasterize PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(rasterizeOperation).toMatchObject({
			name: 'Rasterize PDF',
			value: 'rasterize',
			action: 'Optimize · Rasterize PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/rasterized-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the JSON resource-ID branch and routes its exact body property', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['rasterize'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('declares every optional field in alphabetical order', () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['rasterize'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
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

		const omitted: IHttpRequestOptions = { url: '/rasterized-pdf', body: {} };
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, omitted),
		).resolves.toBe(omitted);

		const invalid: IHttpRequestOptions = {
			url: '/rasterized-pdf',
			body: { output: '' },
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, invalid),
		).rejects.toThrow('Output File Name must contain at least one character.');
	});

	it('routes Include-File-Info using its declared false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});

		const request: IHttpRequestOptions = { url: '/rasterized-pdf' };
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

	it('exposes Response-Type but removes its header by default', async () => {
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

		const request: IHttpRequestOptions = {
			url: '/rasterized-pdf',
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

	it('has no conditional request branches beyond the selected resource-ID input', () => {
		const publicDefinition = JSON.stringify(rasterizeDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('pageSize');
		expect(publicDefinition).not.toContain('displayOptions":{"show":{"output');

		const bodyProperties = rasterizeDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output']);
	});

	it('hides the multipart file field and every public binary input', () => {
		const publicDefinition = JSON.stringify(rasterizeDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binary');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
