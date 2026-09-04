import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	flattenAnnotationsDescription,
	flattenAnnotationsOperation,
} from '../../../../nodes/PdfRest/actions/flattenAnnotations.operation';

function getOptionalField(name: string) {
	return flattenAnnotationsDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Flatten PDF Annotations',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Flatten PDF Annotations operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(flattenAnnotationsOperation).toMatchObject({
			name: 'Flatten PDF Annotations',
			value: 'flattenAnnotations',
			action: 'Optimize · Flatten Annotations',
			routing: {
				request: {
					method: 'POST',
					url: '/flattened-annotations-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('exposes Resource ID as the only required public input branch', () => {
		expect(flattenAnnotationsDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['flattenAnnotations'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional field alphabetically with exact routing', () => {
		const optionalFields = flattenAnnotationsDescription[1];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['flattenAnnotations'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
		expect(getOptionalField('output')).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
	});

	it('omits inactive output and validates it when supplied', async () => {
		const output = getOptionalField('output');
		const omitted: IHttpRequestOptions = { url: '/flattened-annotations-pdf', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);

		const valid: IHttpRequestOptions = {
			url: '/flattened-annotations-pdf',
			body: { output: 'flattened' },
		};
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, valid)).resolves.toBe(valid);

		for (const value of ['', 0]) {
			await expect(
				output?.routing?.send?.preSend?.[0]?.call(nodeContext, {
					url: '/flattened-annotations-pdf',
					body: { output: value },
				}),
			).rejects.toThrow('Output File Name must contain at least one character.');
		}
	});

	it('routes Include-File-Info with its declared false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			description: expect.stringMatching(/^Whether to/),
		});

		for (const value of [false, true]) {
			const request: IHttpRequestOptions = { url: '/flattened-annotations-pdf' };
			await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
				{ getNodeParameter: () => value } as unknown as IExecuteSingleFunctions,
				request,
			);
			expect(request.headers).toEqual({ 'Include-File-Info': value });
		}
	});

	it('omits Response-Type by default and supports requestId', async () => {
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

		const synchronousRequest: IHttpRequestOptions = {
			url: '/flattened-annotations-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/flattened-annotations-pdf' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes every JSON property and no multipart binary input', () => {
		const definition = JSON.stringify(flattenAnnotationsDescription);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = flattenAnnotationsDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output']);
	});
});
