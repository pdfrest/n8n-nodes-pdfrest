import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	flattenTransparenciesDescription,
	flattenTransparenciesOperation,
} from '../../../../nodes/PdfRest/actions/flattenTransparencies.operation';

function getField(name: string) {
	return flattenTransparenciesDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Flatten PDF Transparencies',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Flatten PDF Transparencies operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(flattenTransparenciesOperation).toMatchObject({
			name: 'Flatten PDF Transparencies',
			value: 'flattenTransparencies',
			action: 'Optimize · Flatten Transparencies',
			routing: {
				request: {
					method: 'POST',
					url: '/flattened-transparencies-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires and routes the existing PDF resource ID', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['flattenTransparencies'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('declares every optional field in alphabetical order', () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['flattenTransparencies'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'quality',
			'responseType',
		]);
	});

	it('maps the complete quality enum and its OpenAPI default', () => {
		expect(getOptionalField('quality')).toMatchObject({
			displayName: 'Quality',
			type: 'options',
			options: [
				{ name: 'High', value: 'high' },
				{ name: 'Low', value: 'low' },
				{ name: 'Medium', value: 'medium' },
			],
			default: 'medium',
			routing: { send: { type: 'body', property: 'quality' } },
		});
	});

	it('keeps optional quality omitted until the user adds it', () => {
		expect(getField('options')?.default).toEqual({});
		expect(getOptionalField('quality')?.displayOptions).toBeUndefined();

		const simplestBody = { id: 'pdf-id' };
		expect(simplestBody).not.toHaveProperty('quality');
	});

	it('routes output and enforces its minimum length without adding it by default', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});

		const omitted: IHttpRequestOptions = {
			url: '/flattened-transparencies-pdf',
			body: {},
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, omitted),
		).resolves.toBe(omitted);

		const invalid: IHttpRequestOptions = {
			url: '/flattened-transparencies-pdf',
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

		const request: IHttpRequestOptions = { url: '/flattened-transparencies-pdf' };
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

	it('exposes Response-Type and removes its header by default', async () => {
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
			url: '/flattened-transparencies-pdf',
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

	it('has no conditional option branches or inactive dependent fields', () => {
		for (const field of getField('options')?.options ?? []) {
			expect(field.displayOptions?.show?.quality).toBeUndefined();
		}

		const bodyProperties = flattenTransparenciesDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output', 'quality']);
	});

	it('hides the multipart file field and all binary selectors', () => {
		const publicDefinition = JSON.stringify(flattenTransparenciesDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binary');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
