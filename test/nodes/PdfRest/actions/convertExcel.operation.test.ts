import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	convertExcelDescription,
	convertExcelOperation,
} from '../../../../nodes/PdfRest/actions/convertExcel.operation';

describe('Convert to Excel operation', () => {
	const optionalFields = convertExcelDescription.find((field) => field.name === 'options');

	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(convertExcelOperation).toMatchObject({
			name: 'Convert PDF to Microsoft Excel',
			value: 'convertExcel',
			action: 'Convert · PDF to Excel (XLSX)',
			routing: {
				request: {
					method: 'POST',
					url: '/excel',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires and routes the public resource ID input', () => {
		const resourceId = convertExcelDescription.find((field) => field.name === 'resourceId');

		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['convertExcel'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('routes the optional constrained output filename without an automatic value', async () => {
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['convertExcel'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);

		const output = optionalFields?.options?.find((field) => field.name === 'output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.description).toContain('without a file extension');
		const invalid: IHttpRequestOptions = { url: '/excel', body: { output: '' } };
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(
				{
					getNode: () => ({
						name: 'Convert to Excel',
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

	it('routes Include-File-Info with its declared false default', async () => {
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(includeFileInfo?.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/excel' };
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

	it('omits inherited Response-Type by default and supports asynchronous requests', async () => {
		const responseType = optionalFields?.options?.find((field) => field.name === 'responseType');
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
		expect(preSend).toBeDefined();
		const synchronousRequest: IHttpRequestOptions = {
			url: '/excel',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await preSend?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/excel' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes only the ID branch and no public binary-file input', () => {
		const publicDefinition = JSON.stringify(convertExcelDescription);

		expect(convertExcelDescription.map((field) => field.name)).toEqual(['resourceId', 'options']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('binaryData');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
