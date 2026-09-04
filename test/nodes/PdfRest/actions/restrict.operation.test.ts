import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { restrictDescription, restrictOperation } from '../../../../nodes/PdfRest/actions/restrict.operation';

function getOptionalField(name: string) {
	return restrictDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Restrict PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Restrict PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(restrictOperation).toMatchObject({
			name: 'Apply PDF Permissions Restrictions',
			value: 'restrict',
			action: 'Secure · Restrict PDF Permissions',
			routing: {
				request: {
					method: 'POST',
					url: '/restricted-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes both required fields', () => {
		expect(restrictDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			required: true,
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(restrictDescription[1]).toMatchObject({
			displayName: 'New Permissions Password',
			name: 'newPermissionsPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: { show: { operation: ['restrict'] } },
			routing: { send: { type: 'body', property: 'new_permissions_password' } },
		});
	});

	it('enforces the new permissions password boundaries', async () => {
		const preSend = restrictDescription[1].routing?.send?.preSend?.[0];
		for (const password of ['123456', 'x'.repeat(128)]) {
			const request: IHttpRequestOptions = {
				url: '/restricted-pdf',
				body: { new_permissions_password: password },
			};
			await expect(preSend?.call(nodeContext, request)).resolves.toBe(request);
		}
		for (const password of ['', '12345', 'x'.repeat(129), 123456]) {
			const request: IHttpRequestOptions = {
				url: '/restricted-pdf',
				body: { new_permissions_password: password },
			};
			await expect(preSend?.call(nodeContext, request)).rejects.toThrow(
				'New Permissions Password must contain between 6 and 128 characters.',
			);
		}
	});

	it('groups every optional field alphabetically with exact routing', () => {
		const optionalFields = restrictDescription[2];
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['restrict'] } },
		});
		expect(optionalFields.options?.map(({ name }) => name)).toEqual([
			'currentOpenPassword',
			'currentPermissionsPassword',
			'includeFileInfo',
			'output',
			'responseType',
			'restrictions',
		]);

		expect(getOptionalField('currentOpenPassword')).toMatchObject({
			displayName: 'Current Open Password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			routing: { send: { type: 'body', property: 'current_open_password' } },
		});
		expect(getOptionalField('currentPermissionsPassword')).toMatchObject({
			displayName: 'Current Permissions Password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			routing: { send: { type: 'body', property: 'current_permissions_password' } },
		});
		expect(getOptionalField('output')).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
	});

	it('preserves the literal optional restrictions[] array and exact enum', () => {
		const restrictions = getOptionalField('restrictions');
		expect(restrictions).toMatchObject({
			displayName: 'Restrictions',
			name: 'restrictions',
			type: 'multiOptions',
			options: [
				{ value: 'edit_annotations' },
				{ value: 'copy_content' },
				{ value: 'edit_content' },
				{ value: 'accessibility_off' },
				{ value: 'edit_document_assembly' },
				{ value: 'edit_fill_and_sign_form_fields' },
				{ value: 'print_high' },
				{ value: 'print_low' },
			],
			default: [],
			routing: {
				send: {
					type: 'body',
					property: 'restrictions[]',
					propertyInDotNotation: false,
				},
			},
		});
	});

	it('validates the optional output minimum length', async () => {
		const output = getOptionalField('output');
		const omitted: IHttpRequestOptions = { url: '/restricted-pdf', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);
		const invalid: IHttpRequestOptions = { url: '/restricted-pdf', body: { output: '' } };
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

		const includeRequest: IHttpRequestOptions = { url: '/restricted-pdf' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseRequest: IHttpRequestOptions = {
			url: '/restricted-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes exact JSON properties and no binary input', () => {
		const publicDefinition = JSON.stringify(restrictDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = restrictDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'new_permissions_password',
			'current_open_password',
			'current_permissions_password',
			'output',
			'restrictions[]',
		]);
	});
});
