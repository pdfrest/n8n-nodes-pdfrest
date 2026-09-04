import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { encryptDescription, encryptOperation } from '../../../../nodes/PdfRest/actions/encrypt.operation';

function getOptionalField(name: string) {
	return encryptDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Encrypt PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Encrypt PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(encryptOperation).toMatchObject({
			name: 'Encrypt PDF with Open Password',
			value: 'encrypt',
			action: 'Secure · Encrypt PDF (Add Password)',
			routing: {
				request: {
					method: 'POST',
					url: '/encrypted-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes both required fields and keeps the password default empty', () => {
		expect(encryptDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			required: true,
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(encryptDescription[1]).toMatchObject({
			displayName: 'New Open Password',
			name: 'newOpenPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: { show: { operation: ['encrypt'] } },
			routing: { send: { type: 'body', property: 'new_open_password' } },
		});
	});

	it('enforces the new open password length boundaries', async () => {
		const preSend = encryptDescription[1].routing?.send?.preSend?.[0];
		for (const password of ['123456', 'x'.repeat(128)]) {
			const request: IHttpRequestOptions = {
				url: '/encrypted-pdf',
				body: { new_open_password: password },
			};
			await expect(preSend?.call(nodeContext, request)).resolves.toBe(request);
		}

		for (const password of ['', '12345', 'x'.repeat(129), 123456]) {
			const request: IHttpRequestOptions = {
				url: '/encrypted-pdf',
				body: { new_open_password: password },
			};
			await expect(preSend?.call(nodeContext, request)).rejects.toThrow(
				'New Open Password must contain between 6 and 128 characters.',
			);
		}
	});

	it('maps optional current passwords and rejects non-string expression values', async () => {
		for (const [name, property] of [
			['currentOpenPassword', 'current_open_password'],
			['currentPermissionsPassword', 'current_permissions_password'],
		] as const) {
			const field = getOptionalField(name);
			expect(field).toMatchObject({
				type: 'string',
				typeOptions: { password: true },
				default: '',
				routing: { send: { type: 'body', property } },
			});

			const omitted: IHttpRequestOptions = { url: '/encrypted-pdf', body: {} };
			await expect(field?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
				omitted,
			);
			const valid: IHttpRequestOptions = { url: '/encrypted-pdf', body: { [property]: '' } };
			await expect(field?.routing?.send?.preSend?.[0]?.call(nodeContext, valid)).resolves.toBe(
				valid,
			);
			const invalid: IHttpRequestOptions = { url: '/encrypted-pdf', body: { [property]: 123 } };
			await expect(field?.routing?.send?.preSend?.[0]?.call(nodeContext, invalid)).rejects.toThrow(
				'must be a string',
			);
		}
	});

	it('groups optional fields alphabetically and validates output', async () => {
		const optionalFields = encryptDescription[2];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['encrypt'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'currentOpenPassword',
			'currentPermissionsPassword',
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
		const invalid: IHttpRequestOptions = { url: '/encrypted-pdf', body: { output: '' } };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('routes Include-File-Info and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const responseType = getOptionalField('responseType');
		expect(includeFileInfo).toMatchObject({
			type: 'boolean',
			default: false,
		});
		expect(responseType).toMatchObject({
			type: 'options',
			default: '',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
		});

		const includeRequest: IHttpRequestOptions = { url: '/encrypted-pdf' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseRequest: IHttpRequestOptions = {
			url: '/encrypted-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes exact JSON properties and no binary input', () => {
		const publicDefinition = JSON.stringify(encryptDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = encryptDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'new_open_password',
			'current_open_password',
			'current_permissions_password',
			'output',
		]);
	});
});
