import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { createNonEmptyBodyStringField } from '../../../../nodes/PdfRest/helpers/bodyFields';

function createContext(): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'pdfRest',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('body fields', () => {
	it('creates an optional string with exact body routing', () => {
		const field = createNonEmptyBodyStringField({
			displayName: 'Output File Name',
			name: 'output',
			bodyProperty: 'output',
			description: 'The generated file name',
		});

		expect(field).toMatchObject({
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			description: 'The generated file name',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(field.routing?.send?.preSend).toHaveLength(1);
	});

	it('allows omission and non-empty values but rejects an explicit empty value', async () => {
		const field = createNonEmptyBodyStringField({
			displayName: 'Output File Name',
			name: 'output',
			bodyProperty: 'output',
			description: 'The generated file name',
		});
		const preSend = field.routing?.send?.preSend?.[0];
		const omitted: IHttpRequestOptions = { url: '/file', body: { id: 'resource-id' } };
		await expect(preSend?.call(createContext(), omitted)).resolves.toBe(omitted);

		const valid: IHttpRequestOptions = {
			url: '/file',
			body: { id: 'resource-id', output: 'result' },
		};
		await expect(preSend?.call(createContext(), valid)).resolves.toBe(valid);

		const invalid: IHttpRequestOptions = {
			url: '/file',
			body: { id: 'resource-id', output: '' },
		};
		await expect(preSend?.call(createContext(), invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('supports password presentation without changing body routing', () => {
		const field = createNonEmptyBodyStringField({
			displayName: 'Password',
			name: 'password',
			bodyProperty: 'password',
			description: 'The password to use',
			password: true,
		});

		expect(field).toMatchObject({
			typeOptions: { password: true },
			routing: { send: { type: 'body', property: 'password' } },
		});
	});
});
