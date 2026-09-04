import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	flattenLayersDescription,
	flattenLayersOperation,
} from '../../../../nodes/PdfRest/actions/flattenLayers.operation';

function getOptionalField(name: string) {
	return flattenLayersDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Flatten PDF Layers',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Flatten PDF Layers operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(flattenLayersOperation).toMatchObject({
			name: 'Flatten PDF Layers',
			value: 'flattenLayers',
			action: 'Optimize · Flatten Layers',
			routing: {
				request: {
					method: 'POST',
					url: '/flattened-layers-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('exposes the required Resource ID as the only public input branch', () => {
		expect(flattenLayersDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['flattenLayers'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups all optional fields alphabetically with exact routing', () => {
		expect(flattenLayersDescription[1]).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['flattenLayers'] } },
		});
		expect(flattenLayersDescription[1].options?.map(({ name }) => name)).toEqual([
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

	it('omits the optional output until added and enforces its minimum length', async () => {
		const output = getOptionalField('output');
		const omitted: IHttpRequestOptions = { url: '/flattened-layers-pdf', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);
		expect(omitted.body).toEqual({});

		const valid: IHttpRequestOptions = {
			url: '/flattened-layers-pdf',
			body: { output: 'flattened-layers' },
		};
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, valid)).resolves.toBe(
			valid,
		);
		for (const value of ['', 123]) {
			await expect(
				output?.routing?.send?.preSend?.[0]?.call(nodeContext, {
					url: '/flattened-layers-pdf',
					body: { output: value },
				}),
			).rejects.toThrow('Output File Name must contain at least one character');
		}
	});

	it('routes Include-File-Info with the declared false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			description: expect.stringMatching(/^Whether to/),
		});
		for (const value of [false, true]) {
			const request: IHttpRequestOptions = { url: '/flattened-layers-pdf' };
			await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
				{ getNodeParameter: () => value } as unknown as IExecuteSingleFunctions,
				request,
			);
			expect(request.headers).toEqual({ 'Include-File-Info': value });
		}
	});

	it('exposes Response-Type but omits its blank synchronous default', async () => {
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
		const synchronous: IHttpRequestOptions = {
			url: '/flattened-layers-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronous,
		);
		expect(synchronous.headers).toEqual({ Accept: 'application/json' });

		const asynchronous: IHttpRequestOptions = { url: '/flattened-layers-pdf' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronous,
		);
		expect(asynchronous.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes the complete JSON contract without binary fields or selectors', () => {
		const definition = JSON.stringify(flattenLayersDescription);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = flattenLayersDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output']);
	});
});
