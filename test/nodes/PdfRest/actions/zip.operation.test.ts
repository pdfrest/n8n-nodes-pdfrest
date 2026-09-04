import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { zipDescription, zipOperation } from '../../../../nodes/PdfRest/actions/zip.operation';

function getOptionalField(name: string) {
	return zipDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

function getField(name: string) {
	return zipDescription.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Zip Files',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Zip Files operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(zipOperation).toMatchObject({
			name: 'Compress Files Into ZIP Archive',
			value: 'zip',
			action: 'Files · ZIP Output Files',
			routing: {
				request: {
					method: 'POST',
					url: '/zip',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('collects a required non-empty Resource ID array under literal id[] routing', () => {
		expect(getField('inputType')).toMatchObject({
			displayName: 'Input Source',
			type: 'options',
			default: 'inputFile',
		});
		expect(getField('resourceIds')).toMatchObject({
			displayName: 'Resource IDs',
			name: 'resourceIds',
			type: 'string',
			typeOptions: {
				multipleValues: true,
				multipleValueButtonText: 'Add Resource ID',
			},
			default: [],
			required: true,
			displayOptions: { show: { operation: ['zip'] } },
			routing: {
				send: {
					type: 'body',
					property: 'id[]',
					propertyInDotNotation: false,
				},
			},
		});
	});

	it('accepts one or more literal or expression-resolved Resource IDs in order', async () => {
		const preSend = getField('resourceIds')?.routing?.send?.preSend?.[0];
		for (const resourceIds of [
			['11111111-1111-4111-8111-111111111111'],
			['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
		]) {
			const request: IHttpRequestOptions = {
				url: '/zip',
				body: { 'id[]': resourceIds },
			};
			await expect(preSend?.call(nodeContext, request)).resolves.toBe(request);
			expect((request.body as Record<string, unknown>)['id[]']).toEqual(resourceIds);
		}
	});

	it('rejects missing, empty, malformed, and blank Resource ID collections', async () => {
		const preSend = getField('resourceIds')?.routing?.send?.preSend?.[0];
		for (const resourceIds of [undefined, [], 'id', [123], [''], ['   ']]) {
			const request: IHttpRequestOptions = {
				url: '/zip',
				body: resourceIds === undefined ? {} : { 'id[]': resourceIds },
			};
			await expect(preSend?.call(nodeContext, request)).rejects.toThrow();
		}
	});

	it('uploads every selected input file under the repeated file field', async () => {
		const field = getField('inputFileDataFieldNames');
		expect(field).toMatchObject({
			displayName: 'Input File Data Field Name',
			typeOptions: {
				multipleValues: true,
				multipleValueButtonText: 'Add Input File Data Field Name',
			},
			default: ['data'],
			displayOptions: { show: { operation: ['zip'], inputType: ['inputFile'] } },
			routing: { send: { type: 'body', property: 'file' } },
		});

		const buffers = { first: Buffer.from('first'), second: Buffer.from('second') };
		const request: IHttpRequestOptions = {
			url: '/zip',
			body: { file: ['first', 'second'], output: 'archive' },
			headers: { 'Content-Type': 'application/json' },
		};
		await field?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: () => ['first', 'second'],
				helpers: {
					assertBinaryData: (name: keyof typeof buffers) => ({
						data: '',
						fileName: `${name}.pdf`,
						mimeType: 'application/pdf',
					}),
					getBinaryDataBuffer: async (name: keyof typeof buffers) => buffers[name],
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);

		const formData = request.body as unknown as FormData;
		expect((formData.getAll('file') as File[]).map(({ name }) => name)).toEqual([
			'first.pdf',
			'second.pdf',
		]);
		expect(formData.get('output')).toBe('archive');
		expect(request.headers).toEqual({});
	});

	it('groups optional fields and applies the declared output default only when added', async () => {
		const optionalFields = getField('options');
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['zip'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);

		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: 'pdfrest_zip',
			routing: { send: { type: 'body', property: 'output' } },
		});

		const omitted: IHttpRequestOptions = { url: '/zip', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);
		expect(omitted.body).toEqual({});

		const defaultAdded: IHttpRequestOptions = {
			url: '/zip',
			body: { output: 'pdfrest_zip' },
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(nodeContext, defaultAdded),
		).resolves.toBe(defaultAdded);
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(nodeContext, {
				url: '/zip',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character.');
	});

	it('routes Include-File-Info and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			type: 'boolean',
			default: false,
		});
		for (const value of [false, true]) {
			const includeRequest: IHttpRequestOptions = { url: '/zip' };
			await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
				{ getNodeParameter: () => value } as unknown as IExecuteSingleFunctions,
				includeRequest,
			);
			expect(includeRequest.headers).toEqual({ 'Include-File-Info': value });
		}

		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({
			type: 'options',
			default: '',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
		});
		const synchronousRequest: IHttpRequestOptions = {
			url: '/zip',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/zip' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes resource-ID and repeated multipart file inputs', () => {
		const definition = JSON.stringify(zipDescription);
		expect(definition).toContain('inputType');
		expect(definition).toContain('inputFileDataFieldNames');
		expect(definition).toContain('Input File');
		expect(definition).toContain('"property":"file"');

		const bodyProperties = zipDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id[]', 'file', 'output']);
	});
});
