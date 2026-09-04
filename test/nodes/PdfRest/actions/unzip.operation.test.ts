import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	unzipDescription,
	unzipOperation,
} from '../../../../nodes/PdfRest/actions/unzip.operation';

function getOptionalField(name: string) {
	return unzipDescription[1].options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Unzip Files',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Unzip Files operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(unzipOperation).toMatchObject({
			name: 'Extract Files from ZIP Archive',
			value: 'unzip',
			action: 'Files · Unzip Archive',
			routing: {
				request: {
					method: 'POST',
					url: '/unzip',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(unzipDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['unzip'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional body property and inherited header alphabetically', () => {
		expect(unzipDescription[1]).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['unzip'] } },
		});
		expect(unzipDescription[1].options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'password',
			'responseType',
		]);
	});

	it('routes and validates each optional non-empty body string', async () => {
		for (const [name, displayName, bodyProperty] of [
			['output', 'Output File Name', 'output'],
			['password', 'Password', 'password'],
		] as const) {
			const field = getOptionalField(name);
			expect(field).toMatchObject({
				displayName,
				name,
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: bodyProperty } },
			});
			expect(field?.routing?.send?.preSend).toHaveLength(1);

			const preSend = field?.routing?.send?.preSend?.[0];
			const omitted: IHttpRequestOptions = { url: '/unzip', body: { id: 'resource-id' } };
			await expect(preSend?.call(executionContext, omitted)).resolves.toBe(omitted);

			const valid: IHttpRequestOptions = {
				url: '/unzip',
				body: { id: 'resource-id', [bodyProperty]: 'value' },
			};
			await expect(preSend?.call(executionContext, valid)).resolves.toBe(valid);

			for (const invalidValue of ['', 123]) {
				const invalid: IHttpRequestOptions = {
					url: '/unzip',
					body: { id: 'resource-id', [bodyProperty]: invalidValue },
				};
				await expect(preSend?.call(executionContext, invalid)).rejects.toThrow(
					`${displayName} must contain at least one character.`,
				);
			}
		}
		expect(getOptionalField('password')?.typeOptions).toEqual({ password: true });
	});

	it('routes Include-File-Info with its declared false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			description: expect.stringMatching(/^Whether to/),
			routing: { send: {} },
		});
		for (const value of [false, true]) {
			const request: IHttpRequestOptions = { url: '/unzip' };
			await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
				{ getNodeParameter: () => value } as unknown as IExecuteSingleFunctions,
				request,
			);
			expect(request.headers).toEqual({ 'Include-File-Info': value });
		}
	});

	it('omits Response-Type by default and supports asynchronous requests', async () => {
		const responseType = getOptionalField('responseType');
		const preSend = responseType?.routing?.send?.preSend?.[0];
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

		const synchronous: IHttpRequestOptions = {
			url: '/unzip',
			headers: { 'Content-Type': 'application/json', 'Response-Type': '' },
		};
		await preSend?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronous,
		);
		expect(synchronous.headers).toEqual({ 'Content-Type': 'application/json' });

		const asynchronous: IHttpRequestOptions = { url: '/unzip' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronous,
		);
		expect(asynchronous.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared body properties', () => {
		const definition = JSON.stringify(unzipDescription);
		const bodyProperties = unzipDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(bodyProperties).toEqual(['id', 'output', 'password']);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('binaryData');
		expect(bodyProperties).not.toContain('file');
	});
});
