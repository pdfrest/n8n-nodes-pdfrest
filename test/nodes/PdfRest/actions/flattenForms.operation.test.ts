import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	flattenFormsDescription,
	flattenFormsOperation,
} from '../../../../nodes/PdfRest/actions/flattenForms.operation';

function getOptionalField(name: string) {
	return flattenFormsDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Flatten PDF Forms',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Flatten PDF Forms operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(flattenFormsOperation).toMatchObject({
			name: 'Flatten PDF Forms',
			value: 'flattenForms',
			action: 'Forms · Flatten PDF Forms',
			routing: {
				request: {
					method: 'POST',
					url: '/flattened-forms-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('exposes the required Resource ID as the only public input branch', () => {
		expect(flattenFormsDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['flattenForms'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('groups every optional field alphabetically', () => {
		expect(flattenFormsDescription[1]).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['flattenForms'] } },
		});
		expect(flattenFormsDescription[1].options?.map(({ name }) => name)).toEqual([
			'asPrinted',
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('maps both exact as_printed string enum branches and the declared default', () => {
		expect(getOptionalField('asPrinted')).toMatchObject({
			displayName: 'Appearance',
			name: 'asPrinted',
			type: 'options',
			options: [
				{ name: 'On-Screen', value: 'false' },
				{ name: 'Printed', value: 'true' },
			],
			default: 'false',
			routing: { send: { type: 'body', property: 'as_printed' } },
		});
		expect(getOptionalField('asPrinted')?.options?.map(({ value }) => value)).toEqual([
			'false',
			'true',
		]);
	});

	it('omits optional fields until added and validates output minimum length', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const omitted: IHttpRequestOptions = { url: '/flattened-forms-pdf', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);
		expect(omitted.body).toEqual({});

		const valid: IHttpRequestOptions = {
			url: '/flattened-forms-pdf',
			body: { output: 'flattened' },
		};
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, valid)).resolves.toBe(
			valid,
		);
		for (const value of ['', 123]) {
			await expect(
				output?.routing?.send?.preSend?.[0]?.call(nodeContext, {
					url: '/flattened-forms-pdf',
					body: { output: value },
				}),
			).rejects.toThrow('Output File Name must contain at least one character');
		}
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			description: expect.stringMatching(/^Whether to/),
		});
		for (const value of [false, true]) {
			const request: IHttpRequestOptions = { url: '/flattened-forms-pdf' };
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
		const synchronous: IHttpRequestOptions = {
			url: '/flattened-forms-pdf',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			synchronous,
		);
		expect(synchronous.headers).toEqual({ Accept: 'application/json' });

		const asynchronous: IHttpRequestOptions = { url: '/flattened-forms-pdf' };
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronous,
		);
		expect(asynchronous.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes the complete JSON contract without binary fields or selectors', () => {
		const definition = JSON.stringify(flattenFormsDescription);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = flattenFormsDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'as_printed', 'output']);
	});
});
