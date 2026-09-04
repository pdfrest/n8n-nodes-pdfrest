import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	exportFormDataDescription,
	exportFormDataOperation,
} from '../../../../nodes/PdfRest/actions/exportFormData.operation';

function getField(name: string) {
	return exportFormDataDescription.find((field) => field.name === name);
}

function getDataFormatField(formType: string) {
	return exportFormDataDescription.find(
		(field) =>
			field.name === 'dataFormat' && field.displayOptions?.show?.formType?.includes(formType),
	);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Export Form Data',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Export Form Data operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(exportFormDataOperation).toMatchObject({
			name: 'Export PDF Form Data',
			value: 'exportFormData',
			action: 'Forms · Export Form Data',
			routing: {
				request: {
					method: 'POST',
					url: '/exported-form-data',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires only the public PDF resource ID branch', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['exportFormData'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('uses a routing-free form-type selector', () => {
		const formType = getField('formType');
		expect(formType).toMatchObject({
			displayName: 'Form Type',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'AcroForm', value: 'acroform' },
				{ name: 'XFA', value: 'xfa' },
			],
			default: 'acroform',
			required: true,
			displayOptions: { show: { operation: ['exportFormData'] } },
			routing: { send: {} },
		});
		expect(formType?.routing?.send?.type).toBeUndefined();
		expect(formType?.routing?.send?.property).toBeUndefined();
		expect(formType?.routing?.send?.preSend).toHaveLength(1);
	});

	it('maps all five format enums through compatible progressive branches', () => {
		expect(getDataFormatField('acroform')).toMatchObject({
			displayName: 'Data Format',
			type: 'options',
			options: [
				{ name: 'FDF', value: 'fdf' },
				{ name: 'XFDF', value: 'xfdf' },
				{ name: 'XML', value: 'xml' },
			],
			default: 'xml',
			required: true,
			displayOptions: {
				show: { operation: ['exportFormData'], formType: ['acroform'] },
			},
			routing: { send: { type: 'body', property: 'data_format' } },
		});
		expect(getDataFormatField('xfa')).toMatchObject({
			displayName: 'Data Format',
			type: 'options',
			options: [
				{ name: 'XDP', value: 'xdp' },
				{ name: 'XFD', value: 'xfd' },
				{ name: 'XML', value: 'xml' },
			],
			default: 'xml',
			required: true,
			displayOptions: { show: { operation: ['exportFormData'], formType: ['xfa'] } },
			routing: { send: { type: 'body', property: 'data_format' } },
		});
		const allFormats = new Set(
			exportFormDataDescription
				.filter(({ name }) => name === 'dataFormat')
				.flatMap(({ options }) => options?.map(({ value }) => value) ?? []),
		);
		expect(allFormats).toEqual(new Set(['fdf', 'xfdf', 'xml', 'xdp', 'xfd']));
	});

	it('accepts each format only for a compatible form type', async () => {
		const preSend = getField('formType')?.routing?.send?.preSend?.[0];
		for (const [formType, formats] of [
			['acroform', ['fdf', 'xfdf', 'xml']],
			['xfa', ['xdp', 'xfd', 'xml']],
		] as const) {
			for (const data_format of formats) {
				const request: IHttpRequestOptions = {
					url: '/exported-form-data',
					body: { id: 'pdf-id', data_format },
				};
				await expect(
					preSend?.call(
						{
							...nodeContext,
							getNodeParameter: () => formType,
						} as unknown as IExecuteSingleFunctions,
						request,
					),
				).resolves.toBe(request);
			}
		}
	});

	it('rejects inactive, missing, and unknown format branches', async () => {
		const preSend = getField('formType')?.routing?.send?.preSend?.[0];
		for (const [formType, data_format, message] of [
			['acroform', 'xdp', 'AcroForm'],
			['xfa', 'fdf', 'XFA'],
			['acroform', '', 'AcroForm'],
			['acroform', undefined, 'AcroForm'],
		] as const) {
			await expect(
				preSend?.call(
					{
						...nodeContext,
						getNodeParameter: () => formType,
					} as unknown as IExecuteSingleFunctions,
					{ url: '/exported-form-data', body: { data_format } },
				),
			).rejects.toThrow(message);
		}
		await expect(
			preSend?.call(
				{
					...nodeContext,
					getNodeParameter: () => 'unknown',
				} as unknown as IExecuteSingleFunctions,
				{ url: '/exported-form-data', body: { data_format: 'xml' } },
			),
		).rejects.toThrow('Form Type has an invalid value');
	});

	it('groups optional fields alphabetically and validates the output filename', async () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['exportFormData'] } },
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
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(nodeContext, {
				url: '/exported-form-data',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character');
	});

	it('uses Include-File-Info false and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			type: 'boolean',
			default: false,
		});
		const includeRequest: IHttpRequestOptions = { url: '/exported-form-data' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({
			default: '',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
		});
		const request: IHttpRequestOptions = {
			url: '/exported-form-data',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes exact JSON properties without the multipart binary input', () => {
		const definition = JSON.stringify(exportFormDataDescription);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = exportFormDataDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'data_format', 'data_format', 'output']);
	});
});
