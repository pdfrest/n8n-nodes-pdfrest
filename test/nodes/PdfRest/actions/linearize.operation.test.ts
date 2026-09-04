import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	linearizeDescription,
	linearizeOperation,
} from '../../../../nodes/PdfRest/actions/linearize.operation';

function getOptionalField(name: string) {
	return linearizeDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Linearize PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Linearize PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(linearizeOperation).toMatchObject({
			name: 'Linearize PDF',
			value: 'linearize',
			action: 'Optimize · Linearize PDF (Fast Web View)',
			routing: {
				request: {
					method: 'POST',
					url: '/linearized-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('exposes the required Resource ID as the only public input branch', () => {
		expect(linearizeDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['linearize'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional field alphabetically with exact routing', () => {
		const optionalFields = linearizeDescription[1];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['linearize'] } },
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

	it('omits the optional output until added and validates its minimum length', async () => {
		const output = getOptionalField('output');
		const omitted: IHttpRequestOptions = { url: '/linearized-pdf', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);

		const valid: IHttpRequestOptions = {
			url: '/linearized-pdf',
			body: { output: 'web-ready' },
		};
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, valid)).resolves.toBe(valid);

		for (const outputValue of ['', 1]) {
			const invalid: IHttpRequestOptions = {
				url: '/linearized-pdf',
				body: { output: outputValue },
			};
			await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, invalid)).rejects.toThrow(
				'Output File Name must contain at least one character.',
			);
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
			const request: IHttpRequestOptions = { url: '/linearized-pdf' };
			await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
				{ getNodeParameter: () => value } as unknown as IExecuteSingleFunctions,
				request,
			);
			expect(request.headers).toEqual({ 'Include-File-Info': value });
		}
	});

	it('exposes Response-Type but removes its blank synchronous default', async () => {
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
			url: '/linearized-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/linearized-pdf' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes the complete JSON contract without a public binary input', () => {
		const definition = JSON.stringify(linearizeDescription);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = linearizeDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'output']);
	});
});
