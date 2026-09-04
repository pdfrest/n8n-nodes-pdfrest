import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	redactionApplyDescription,
	redactionApplyOperation,
} from '../../../../nodes/PdfRest/actions/redactionApply.operation';

function getOptionalField(name: string) {
	return redactionApplyDescription[1].options?.find((field) => field.name === name);
}

function createContext(): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Apply Finalized Text Redactions to PDF',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('Apply Text Redactions operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(redactionApplyOperation).toMatchObject({
			name: 'Apply Finalized Text Redactions to PDF',
			value: 'redactionApply',
			action: 'Secure · Redact PDF Text (Apply)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-redacted-text-applied',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(redactionApplyDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['redactionApply'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional property and inherited header alphabetically', () => {
		expect(redactionApplyDescription[1]).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['redactionApply'] } },
		});
		expect(redactionApplyDescription[1].options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'redactionColor',
			'responseType',
		]);
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
			url: '/pdf-with-redacted-text-applied',
			body: { id: 'resource-id' },
		};
		await expect(preSend?.call(createContext(), omitted)).resolves.toBe(omitted);

		const valid: IHttpRequestOptions = {
			url: '/pdf-with-redacted-text-applied',
			body: { id: 'resource-id', output: 'redacted' },
		};
		await expect(preSend?.call(createContext(), valid)).resolves.toBe(valid);

		const invalid: IHttpRequestOptions = {
			url: '/pdf-with-redacted-text-applied',
			body: { id: 'resource-id', output: '' },
		};
		await expect(preSend?.call(createContext(), invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('maps Redaction Color with its declared default and exact route', () => {
		const redactionColor = getOptionalField('redactionColor');

		expect(redactionColor).toMatchObject({
			displayName: 'Redaction Color',
			name: 'redactionColor',
			type: 'color',
			default: '#000000',
			routing: { send: { type: 'body', property: 'rgb_color' } },
		});
		expect(redactionColor?.routing?.send?.preSend).toHaveLength(1);
	});

	it('converts six-digit hex colors to comma-separated RGB channels', async () => {
		const preSend = getOptionalField('redactionColor')?.routing?.send?.preSend?.[0];

		for (const [value, expected] of [
			['#000000', '0,0,0'],
			['#ffffff', '255,255,255'],
			['#1A70ff', '26,112,255'],
		] as const) {
			const request: IHttpRequestOptions = {
				url: '/pdf-with-redacted-text-applied',
				body: { rgb_color: value },
			};
			await expect(preSend?.call(createContext(), request)).resolves.toBe(request);
			expect(request.body).toEqual({ rgb_color: expected });
		}
	});

	it('rejects values outside the six-digit hex color format', async () => {
		const preSend = getOptionalField('redactionColor')?.routing?.send?.preSend?.[0];

		for (const value of ['', '#fff', '#000000ff', '000000', '#gg0000', '255,0,0']) {
			const request: IHttpRequestOptions = {
				url: '/pdf-with-redacted-text-applied',
				body: { rgb_color: value },
			};
			await expect(preSend?.call(createContext(), request)).rejects.toThrow(
				'Redaction Color must be a six-digit hexadecimal color.',
			);
		}
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/pdf-with-redacted-text-applied' };

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
			url: '/pdf-with-redacted-text-applied',
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

		const asynchronousRequest: IHttpRequestOptions = {
			url: '/pdf-with-redacted-text-applied',
		};
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes exactly the JSON ID branch and declared body properties', () => {
		const publicDefinition = JSON.stringify(redactionApplyDescription);
		const bodyProperties = redactionApplyDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(bodyProperties).toEqual(['id', 'output', 'rgb_color']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('binaryData');
		expect(bodyProperties).not.toContain('file');
	});
});
