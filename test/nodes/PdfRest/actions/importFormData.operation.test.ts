import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	importFormDataDescription,
	importFormDataOperation,
} from '../../../../nodes/PdfRest/actions/importFormData.operation';

function getField(name: string) {
	return importFormDataDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Import Form Data into PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Import Form Data into PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(importFormDataOperation).toMatchObject({
			name: 'Import Form Data into PDF',
			value: 'importFormData',
			action: 'Forms · Import Form Data',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-imported-form-data',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the primary editable PDF resource ID', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['importFormData'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('requires the secondary form-data resource ID when selected', () => {
		expect(getField('dataFileResourceId')).toMatchObject({
			displayName: 'Form Data Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: { operation: ['importFormData'], formDataInputType: ['resourceId'] },
			},
			routing: { send: { type: 'body', property: 'data_file_id' } },
		});
	});

	it('defaults form data to an input file and retains the resource-ID branch', () => {
		expect(getField('formDataInputType')).toMatchObject({ default: 'inputFile' });
		expect(getField('dataFileResourceId')?.displayOptions).toEqual({
			show: { operation: ['importFormData'], formDataInputType: ['resourceId'] },
		});
	});

	it('declares every optional field in alphabetical order', () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['importFormData'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('routes the optional output filename and omits it until added', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});

		const omitted: IHttpRequestOptions = {
			url: '/pdf-with-imported-form-data',
			body: {},
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, omitted),
		).resolves.toBe(omitted);

		const invalid: IHttpRequestOptions = {
			url: '/pdf-with-imported-form-data',
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

		const request: IHttpRequestOptions = { url: '/pdf-with-imported-form-data' };
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
			url: '/pdf-with-imported-form-data',
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

	it('routes every and only ImportedFormDataJsonRequest body property', () => {
		const bodyProperties = importFormDataDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'data_file_id', 'data_file', 'output']);
	});

	it('exposes the singular form-data file and resource-ID input branches', () => {
		const publicDefinition = JSON.stringify(importFormDataDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).toContain('Input File');
		expect(publicDefinition).toContain('data_file');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
