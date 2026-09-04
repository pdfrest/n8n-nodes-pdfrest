import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	decryptDescription,
	decryptOperation,
} from '../../../../nodes/PdfRest/actions/decrypt.operation';

function getOptionalField(name: string) {
	return decryptDescription[2].options?.find((field) => field.name === name);
}

function createContext(): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Remove Encryption from PDF',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('Decrypt PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(decryptOperation).toMatchObject({
			name: 'Remove Encryption from PDF',
			value: 'decrypt',
			action: 'Secure · Decrypt PDF (Remove Password)',
			routing: {
				request: {
					method: 'POST',
					url: '/decrypted-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(decryptDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['decrypt'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('requires the current open password without inventing a length constraint', () => {
		expect(decryptDescription[1]).toMatchObject({
			displayName: 'Current Open Password',
			name: 'currentOpenPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: { show: { operation: ['decrypt'] } },
			routing: { send: { type: 'body', property: 'current_open_password' } },
		});
		expect(decryptDescription[1].routing?.send?.preSend).toBeUndefined();
		expect(decryptDescription[1].typeOptions).not.toHaveProperty('minValue');
		expect(decryptDescription[1].typeOptions).not.toHaveProperty('maxValue');
	});

	it('groups every optional property and inherited header alphabetically', () => {
		expect(decryptDescription[2]).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['decrypt'] } },
		});
		expect(decryptDescription[2].options?.map((field) => field.name)).toEqual([
			'currentPermissionsPassword',
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('routes the optional permissions password without inventing constraints', () => {
		const password = getOptionalField('currentPermissionsPassword');

		expect(password).toMatchObject({
			displayName: 'Current Permissions Password',
			name: 'currentPermissionsPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			routing: { send: { type: 'body', property: 'current_permissions_password' } },
		});
		expect(password?.routing?.send?.preSend).toBeUndefined();
		expect(password?.typeOptions).not.toHaveProperty('minValue');
		expect(password?.typeOptions).not.toHaveProperty('maxValue');
	});

	it('routes and validates the optional non-empty output file name', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.routing?.send?.preSend).toHaveLength(1);

		const preSend = output?.routing?.send?.preSend?.[0];
		const omitted: IHttpRequestOptions = {
			url: '/decrypted-pdf',
			body: { id: 'resource-id', current_open_password: 'password' },
		};
		await expect(preSend?.call(createContext(), omitted)).resolves.toBe(omitted);

		const valid: IHttpRequestOptions = {
			url: '/decrypted-pdf',
			body: { id: 'resource-id', current_open_password: 'password', output: 'decrypted' },
		};
		await expect(preSend?.call(createContext(), valid)).resolves.toBe(valid);

		const invalid: IHttpRequestOptions = {
			url: '/decrypted-pdf',
			body: { id: 'resource-id', current_open_password: 'password', output: '' },
		};
		await expect(preSend?.call(createContext(), invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/decrypted-pdf' };

		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
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

	it('omits Response-Type by default and supports requestId', async () => {
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

		const synchronousRequest: IHttpRequestOptions = {
			url: '/decrypted-pdf',
			headers: { 'Content-Type': 'application/json', 'Response-Type': '' },
		};
		await preSend?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ 'Content-Type': 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/decrypted-pdf' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared body properties', () => {
		const publicDefinition = JSON.stringify(decryptDescription);
		const bodyProperties = decryptDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(bodyProperties).toEqual([
			'id',
			'current_open_password',
			'current_permissions_password',
			'output',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(bodyProperties).not.toContain('file');
	});
});
