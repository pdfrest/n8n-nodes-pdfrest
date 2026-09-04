import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { signDescription, signOperation } from '../../../../nodes/PdfRest/actions/sign.operation';
import { createDeferredMultipartUploadsPreSend } from '../../../../nodes/PdfRest/helpers/multipart';

function getField(name: string) {
	return signDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Sign PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Sign PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(signOperation).toMatchObject({
			name: 'Digitally Sign PDF',
			value: 'sign',
			action: 'Secure · Sign PDF (Digital Signature)',
			routing: {
				request: {
					method: 'POST',
					url: '/signed-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public PDF resource ID and a routing-free credential selector', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['sign'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});

		const credentialType = getField('credentialType');
		expect(credentialType).toMatchObject({
			displayName: 'Credential Type',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Certificate', value: 'certificate' },
				{ name: 'PFX', value: 'pfx' },
			],
			default: 'pfx',
			required: true,
			displayOptions: { show: { operation: ['sign'] } },
			routing: { send: {} },
		});
		expect(credentialType?.routing?.send?.type).toBeUndefined();
		expect(credentialType?.routing?.send?.property).toBeUndefined();
		expect(credentialType?.routing?.send?.preSend).toHaveLength(2);
	});

	it('maps the two complete resource-ID credential branches with progressive disclosure', () => {
		for (const [name, displayName, credentialType, inputTypeName, property] of [
			[
				'pfxCredentialId',
				'PFX Credential Resource ID',
				'pfx',
				'pfxCredentialInputType',
				'pfx_credential_id',
			],
			[
				'pfxPassphraseId',
				'PFX Passphrase Resource ID',
				'pfx',
				'pfxPassphraseInputType',
				'pfx_passphrase_id',
			],
			[
				'certificateId',
				'Certificate Resource ID',
				'certificate',
				'certificateInputType',
				'certificate_id',
			],
			[
				'privateKeyId',
				'Private Key Resource ID',
				'certificate',
				'privateKeyInputType',
				'private_key_id',
			],
		] as const) {
			expect(getField(name)).toMatchObject({
				displayName,
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['sign'],
						credentialType: [credentialType],
						[inputTypeName]: ['resourceId'],
					},
				},
				routing: { send: { type: 'body', property } },
			});
		}
	});

	it('retains only the selected credential branch and requires its complete pair', async () => {
		const preSend = getField('credentialType')?.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();

		const pfxRequest: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: {
				id: 'pdf-id',
				pfx_credential_id: 'pfx-id',
				pfx_passphrase_id: 'passphrase-id',
				certificate_id: 'stale-certificate',
				private_key_id: 'stale-private-key',
			},
		};
		await preSend?.call(
			{
				...executionContext,
				getNodeParameter: (name: string, fallback: unknown) => {
					expect(name).toBe('credentialType');
					expect(fallback).toBe('pfx');
					return 'pfx';
				},
			} as unknown as IExecuteSingleFunctions,
			pfxRequest,
		);
		expect(pfxRequest.body).toEqual({
			id: 'pdf-id',
			pfx_credential_id: 'pfx-id',
			pfx_passphrase_id: 'passphrase-id',
		});

		const certificateRequest: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: {
				id: 'pdf-id',
				pfx_credential_id: 'stale-pfx',
				pfx_passphrase_id: 'stale-passphrase',
				certificate_id: 'certificate-id',
				private_key_id: 'private-key-id',
			},
		};
		await preSend?.call(
			{
				...executionContext,
				getNodeParameter: () => 'certificate',
			} as unknown as IExecuteSingleFunctions,
			certificateRequest,
		);
		expect(certificateRequest.body).toEqual({
			id: 'pdf-id',
			certificate_id: 'certificate-id',
			private_key_id: 'private-key-id',
		});

		const incompleteRequest: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: { id: 'pdf-id', pfx_credential_id: 'pfx-id' },
		};
		await expect(
			preSend?.call(
				{
					...executionContext,
					getNodeParameter: () => 'pfx',
				} as unknown as IExecuteSingleFunctions,
				incompleteRequest,
			),
		).resolves.toBe(incompleteRequest);

		const invalidTypeRequest: IHttpRequestOptions = { url: '/signed-pdf', body: {} };
		await expect(
			preSend?.call(
				{
					...executionContext,
					getNodeParameter: () => 'unknown',
				} as unknown as IExecuteSingleFunctions,
				invalidTypeRequest,
			),
		).rejects.toThrow('Credential Type has an invalid value');
	});

	it('accepts typed JSON and serializes the complete signature content schema', async () => {
		const signatureConfiguration = getField('signatureConfiguration');
		expect(signatureConfiguration).toMatchObject({
			displayName: 'Signature Configuration',
			type: 'json',
			required: true,
			displayOptions: { show: { operation: ['sign'] } },
			routing: { send: { type: 'body', property: 'signature_configuration' } },
		});
		expect(String(signatureConfiguration?.default)).toContain('\n');
		expect(JSON.parse(String(signatureConfiguration?.default))).toEqual({
			type: 'new',
			name: 'esignature',
			logo_opacity: '0.5',
			location: {
				bottom_left: { x: '0', y: '0' },
				top_right: { x: '216', y: '72' },
				page: '1',
			},
			display: {
				include_distinguished_name: 'true',
				include_datetime: 'true',
				contact: 'My contact information',
				location: 'My signing location',
				name: 'John Doe',
				reason: 'My reason for signing',
			},
		});

		const configuration = {
			type: 'new',
			name: 'esignature',
			logo_opacity: '0.5',
			location: {
				bottom_left: { x: '0', y: '0' },
				top_right: { x: '216', y: '72' },
				page: '1',
			},
			display: {
				include_distinguished_name: 'true',
				include_datetime: 'false',
				contact: 'support@example.com',
				location: 'Chicago',
				name: 'Signer',
				reason: 'Approval',
			},
		};
		const request: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: { id: 'pdf-id', signature_configuration: configuration },
		};
		await signatureConfiguration?.routing?.send?.preSend?.[0]?.call(executionContext, request);
		expect(typeof (request.body as Record<string, unknown>).signature_configuration).toBe('string');
		expect(
			JSON.parse(String((request.body as Record<string, unknown>).signature_configuration)),
		).toEqual(configuration);
	});

	it('accepts JSON text and rejects every invalid signature schema category', async () => {
		const preSend = getField('signatureConfiguration')?.routing?.send?.preSend?.[0];
		const textRequest: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: { signature_configuration: '{"type":"new","name":"esignature"}' },
		};
		await expect(preSend?.call(executionContext, textRequest)).resolves.toBe(textRequest);
		expect((textRequest.body as Record<string, unknown>).signature_configuration).toBe(
			'{"type":"new","name":"esignature"}',
		);

		const invalidConfigurations: unknown[] = [
			'{not json}',
			{ type: 'new' },
			{ name: 'esignature' },
			{ type: 1, name: 'esignature' },
			{ type: 'new', name: 'esignature', extra: true },
			{ type: 'new', name: 'esignature', logo_opacity: '1.1' },
			{ type: 'new', name: 'esignature', logo_opacity: 0.5 },
			{
				type: 'new',
				name: 'esignature',
				location: { bottom_left: { x: '0', y: '0' }, top_right: { x: '1', y: '1' } },
			},
			{
				type: 'new',
				name: 'esignature',
				location: {
					bottom_left: { x: 0, y: '0' },
					top_right: { x: '1', y: '1' },
					page: '1',
				},
			},
			{
				type: 'new',
				name: 'esignature',
				location: {
					bottom_left: { x: '0', y: '0' },
					top_right: { x: '1', y: '1' },
					page: '1',
					extra: 'value',
				},
			},
			{
				type: 'new',
				name: 'esignature',
				location: {
					bottom_left: { x: '0', y: '0', extra: 'value' },
					top_right: { x: '1', y: '1' },
					page: '1',
				},
			},
			{
				type: 'new',
				name: 'esignature',
				display: { include_datetime: true },
			},
			{ type: 'new', name: 'esignature', display: { unsupported: 'value' } },
			{ type: 'new', name: 'esignature', display: { contact: 123 } },
		];

		for (const signature_configuration of invalidConfigurations) {
			const request: IHttpRequestOptions = {
				url: '/signed-pdf',
				body: { signature_configuration },
			};
			await expect(preSend?.call(executionContext, request)).rejects.toThrow();
		}
	});

	it('maps the optional logo, validated output, and alphabetized collection', async () => {
		const optionalFields = getField('options');
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['sign'] } },
		});
		expect(optionalFields?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'logoInputType',
			'logoId',
			'logoFileDataFieldName',
			'output',
			'responseType',
		]);
		const logo = getOptionalField('logoId');
		expect(logo).toMatchObject({
			displayName: 'Logo Resource ID',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'logo_id' } },
		});
		expect(logo?.displayOptions).toEqual({ show: { logoInputType: ['resourceId'] } });
		expect(getOptionalField('logoFileDataFieldName')).toMatchObject({
			displayName: 'Logo Input File Data Field Name',
		});
		expect(getOptionalField('logoFileDataFieldName')?.routing?.send?.preSend).toBeUndefined();

		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const invalidOutput: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: { output: '' },
		};
		const omittedOutput: IHttpRequestOptions = { url: '/signed-pdf', body: {} };
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, omittedOutput),
		).resolves.toBe(omittedOutput);
		const validOutput: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: { output: 'signed-document' },
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, validOutput),
		).resolves.toBe(validOutput);
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, invalidOutput),
		).rejects.toThrow('Output File Name must contain at least one character');
	});

	it('adds an input-file logo to the final multipart request', async () => {
		const logoPreSend = getField('credentialType')?.routing?.send?.preSend?.[1];
		expect(logoPreSend).toBeDefined();
		const options = { logoInputType: 'inputFile', logoFileDataFieldName: 'data_3' };
		const context = {
			...executionContext,
			getNodeParameter: (name: string, fallback: unknown) => {
				if (name === 'options') return options;
				if (name === 'options.logoFileDataFieldName') return options.logoFileDataFieldName;
				return fallback;
			},
			helpers: {
				assertBinaryData: (propertyName: string) => ({
					data: '',
					fileName: propertyName === 'data_3' ? 'signature-logo.png' : 'input.bin',
					mimeType: propertyName === 'data_3' ? 'image/png' : 'application/octet-stream',
				}),
				getBinaryDataBuffer: async (propertyName: string) => Buffer.from(propertyName),
			},
		} as unknown as IExecuteSingleFunctions;
		const request: IHttpRequestOptions = {
			url: '/signed-pdf',
			body: { signature_configuration: '{"type":"new","name":"esignature"}' },
		};

		await logoPreSend?.call(context, request);
		expect(request.body).toEqual({
			logo_file: 'data_3',
			signature_configuration: '{"type":"new","name":"esignature"}',
		});
		await createDeferredMultipartUploadsPreSend().call(context, request);

		const formData = request.body as unknown as FormData;
		expect(formData).toBeInstanceOf(FormData);
		expect((formData.get('logo_file') as File).name).toBe('signature-logo.png');
		expect((formData.get('logo_file') as File).type).toBe('image/png');
	});

	it('routes both headers and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});
		const includeRequest: IHttpRequestOptions = { url: '/signed-pdf' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
		});
		const synchronousRequest: IHttpRequestOptions = {
			url: '/signed-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/signed-pdf' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes singular signing file and resource-ID branches', () => {
		const publicDefinition = JSON.stringify(signDescription);
		for (const exposedName of [
			'pfx_credential_file',
			'pfx_passphrase_file',
			'certificate_file',
			'private_key_file',
			'logo_file',
		]) {
			expect(publicDefinition).toContain(exposedName);
		}
		expect(publicDefinition).toContain('Input File');

		const bodyProperties = signDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'pfx_credential_id',
			'pfx_credential_file',
			'pfx_passphrase_id',
			'pfx_passphrase_file',
			'certificate_id',
			'certificate_file',
			'private_key_id',
			'private_key_file',
			'signature_configuration',
			'logo_id',
			'logo_file',
			'output',
		]);
	});
});
