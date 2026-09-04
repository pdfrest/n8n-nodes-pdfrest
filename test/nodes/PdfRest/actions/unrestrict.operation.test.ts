import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	unrestrictDescription,
	unrestrictOperation,
} from '../../../../nodes/PdfRest/actions/unrestrict.operation';

function getOptionalField(name: string) {
	return unrestrictDescription[2].options?.find((field) => field.name === name);
}

function createContext(): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Remove PDF Permissions Restrictions',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('Unrestrict PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(unrestrictOperation).toMatchObject({
			name: 'Remove PDF Permissions Restrictions',
			value: 'unrestrict',
			action: 'Secure · Remove PDF Restrictions',
			routing: {
				request: {
					method: 'POST',
					url: '/unrestricted-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(unrestrictDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['unrestrict'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('requires the permissions password without inventing a length constraint', () => {
		expect(unrestrictDescription[1]).toMatchObject({
			displayName: 'Current Permissions Password',
			name: 'currentPermissionsPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: { show: { operation: ['unrestrict'] } },
			routing: { send: { type: 'body', property: 'current_permissions_password' } },
		});
		expect(unrestrictDescription[1].routing?.send?.preSend).toBeUndefined();
		expect(unrestrictDescription[1].typeOptions).not.toHaveProperty('minValue');
		expect(unrestrictDescription[1].typeOptions).not.toHaveProperty('maxValue');
	});

	it('groups every optional property and inherited header alphabetically', () => {
		expect(unrestrictDescription[2]).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['unrestrict'] } },
		});
		expect(unrestrictDescription[2].options?.map((field) => field.name)).toEqual([
			'currentOpenPassword',
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('routes the optional open password without inventing constraints', () => {
		const password = getOptionalField('currentOpenPassword');

		expect(password).toMatchObject({
			displayName: 'Current Open Password',
			name: 'currentOpenPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			routing: { send: { type: 'body', property: 'current_open_password' } },
		});
		expect(password?.routing?.send?.preSend).toBeUndefined();
		expect(password?.typeOptions).not.toHaveProperty('minValue');
		expect(password?.typeOptions).not.toHaveProperty('maxValue');
	});

	it('omits optional fields until they are selected', () => {
		expect(unrestrictDescription[2].default).toEqual({});
		expect(getOptionalField('currentOpenPassword')?.default).toBe('');
		expect(getOptionalField('output')?.default).toBe('');
		expect(getOptionalField('responseType')?.default).toBe('');
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
			url: '/unrestricted-pdf',
			body: { id: 'resource-id', current_permissions_password: 'password' },
		};
		await expect(preSend?.call(createContext(), omitted)).resolves.toBe(omitted);

		const valid: IHttpRequestOptions = {
			url: '/unrestricted-pdf',
			body: {
				id: 'resource-id',
				current_permissions_password: 'password',
				output: 'unrestricted',
			},
		};
		await expect(preSend?.call(createContext(), valid)).resolves.toBe(valid);

		const invalid: IHttpRequestOptions = {
			url: '/unrestricted-pdf',
			body: { id: 'resource-id', current_permissions_password: 'password', output: '' },
		};
		await expect(preSend?.call(createContext(), invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/unrestricted-pdf' };

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
			url: '/unrestricted-pdf',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/unrestricted-pdf' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared body properties', () => {
		const publicDefinition = JSON.stringify(unrestrictDescription);
		const bodyProperties = unrestrictDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(bodyProperties).toEqual([
			'id',
			'current_permissions_password',
			'current_open_password',
			'output',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(bodyProperties).not.toContain('file');
	});
});
