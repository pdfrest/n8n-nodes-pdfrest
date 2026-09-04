import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	redactionPreviewDescription,
	redactionPreviewOperation,
} from '../../../../nodes/PdfRest/actions/redactionPreview.operation';

function getOptionalField(name: string) {
	return redactionPreviewDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Preview Text Redactions',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Preview Text Redactions operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(redactionPreviewOperation).toMatchObject({
			name: 'Generate Redaction Preview PDF',
			value: 'redactionPreview',
			action: 'Secure · Redact PDF Text (Preview)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-redacted-text-preview',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required resource ID and JSON redactions', () => {
		expect(redactionPreviewDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['redactionPreview'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(redactionPreviewDescription[1]).toMatchObject({
			displayName: 'Redactions',
			name: 'redactions',
			type: 'json',
			required: true,
			displayOptions: { show: { operation: ['redactionPreview'] } },
			routing: { send: { type: 'body', property: 'redactions' } },
		});
		expect(redactionPreviewDescription[1].routing?.send?.preSend).toHaveLength(1);
		expect(String(redactionPreviewDescription[1].default)).toContain('\n');
		expect(() => JSON.parse(redactionPreviewDescription[1].default as string)).not.toThrow();
	});

	it('accepts and serializes every redaction branch from typed JSON', async () => {
		const preSend = redactionPreviewDescription[1].routing?.send?.preSend?.[0];
		const presets = [
			'email',
			'phone_number',
			'date',
			'us_ssn',
			'url',
			'credit_card',
			'credit_debit_pin',
			'bank_routing_number',
			'international_bank_account_number',
			'swift_bic_number',
			'ipv4',
			'ipv6',
		];
		const redactions = [
			{ type: 'literal', value: 'Customer Name' },
			{ type: 'regex', value: '\\d{3}-\\d{2}-\\d{4}' },
			...presets.map((value) => ({ type: 'preset', value })),
		];
		const request: IHttpRequestOptions = { url: '/preview', body: { redactions } };

		await expect(preSend?.call(nodeContext, request)).resolves.toBe(request);
		expect(request.body).toEqual({ redactions: JSON.stringify(redactions) });
	});

	it('accepts literal JSON and normalizes it to the API string property', async () => {
		const preSend = redactionPreviewDescription[1].routing?.send?.preSend?.[0];
		const input = '[ { "type": "preset", "value": "email" } ]';
		const request: IHttpRequestOptions = {
			url: '/preview',
			body: { id: 'resource-id', redactions: input },
		};

		await expect(preSend?.call(nodeContext, request)).resolves.toBe(request);
		expect(request.body).toEqual({
			id: 'resource-id',
			redactions: '[{"type":"preset","value":"email"}]',
		});
	});

	it.each([
		['invalid JSON', '{'],
		['non-array JSON', { type: 'literal', value: 'x' }],
		['non-object item', [null]],
		['array item', [['literal', 'x']]],
		['missing type', [{ value: 'x' }]],
		['missing value', [{ type: 'literal' }]],
		['extra property', [{ type: 'literal', value: 'x', pages: '1' }]],
		['unknown type', [{ type: 'exact', value: 'x' }]],
		['non-string literal', [{ type: 'literal', value: 123 }]],
		['non-string regex', [{ type: 'regex', value: false }]],
		['unknown preset', [{ type: 'preset', value: 'passport' }]],
	])('rejects %s', async (_case, redactions) => {
		const preSend = redactionPreviewDescription[1].routing?.send?.preSend?.[0];
		const request: IHttpRequestOptions = { url: '/preview', body: { redactions } };
		await expect(preSend?.call(nodeContext, request)).rejects.toThrow(/Redactions must/);
	});

	it('groups and validates optional fields alphabetically', async () => {
		const optionalFields = redactionPreviewDescription.find((field) => field.name === 'options')!;
		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['redactionPreview'] } },
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
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const invalid: IHttpRequestOptions = { url: '/preview', body: { output: '' } };
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

		const includeRequest: IHttpRequestOptions = { url: '/preview' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseRequest: IHttpRequestOptions = {
			url: '/preview',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes only exact JSON properties and no binary input', () => {
		const publicDefinition = JSON.stringify(redactionPreviewDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = redactionPreviewDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'redactions', 'output']);
	});
});
