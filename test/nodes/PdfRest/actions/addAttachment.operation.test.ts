import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	addAttachmentDescription,
	addAttachmentOperation,
} from '../../../../nodes/PdfRest/actions/addAttachment.operation';

function getField(name: string) {
	return addAttachmentDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const executionContext = {
	getNode: () => ({
		name: 'Add Attachment to PDF',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

describe('Add Attachment to PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(addAttachmentOperation).toMatchObject({
			name: 'Add Attachment to PDF',
			value: 'addAttachment',
			action: 'Modify · Add Attachment to PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-added-attachment',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires and routes the primary PDF resource ID', () => {
		const resourceId = getField('resourceId');
		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['addAttachment'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(resourceId?.noDataExpression).toBeUndefined();
	});

	it('requires and routes the secondary attachment resource ID', () => {
		const attachmentResourceId = getField('attachmentResourceId');
		expect(attachmentResourceId).toMatchObject({
			displayName: 'Attachment Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['addAttachment'] } },
			routing: { send: { type: 'body', property: 'id_to_attach' } },
		});
		expect(attachmentResourceId?.noDataExpression).toBeUndefined();
	});

	it('accepts n8n expressions for both resource ID fields', () => {
		for (const fieldName of ['resourceId', 'attachmentResourceId']) {
			const field = getField(fieldName);
			expect(field).toMatchObject({ type: 'string' });
			expect(field?.noDataExpression).toBeUndefined();
			expect(field?.default).toBe('');
		}

		const representativeParameters = {
			resourceId: '={{ $json.files[0].id }}',
			attachmentResourceId: '={{ $json.files[1].id }}',
		};
		expect(representativeParameters.resourceId).toContain('{{');
		expect(representativeParameters.attachmentResourceId).toContain('{{');
	});

	it('declares the complete alphabetized optional field collection', () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['addAttachment'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('routes the optional output filename and enforces minLength one', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});

		const omitted: IHttpRequestOptions = {
			url: '/pdf-with-added-attachment',
			body: {},
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, omitted),
		).resolves.toBe(omitted);

		const invalid: IHttpRequestOptions = {
			url: '/pdf-with-added-attachment',
			body: { output: '' },
		};
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(executionContext, invalid),
		).rejects.toThrow('Output File Name must contain at least one character.');
	});

	it('routes Include-File-Info using its declared false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
		});

		const request: IHttpRequestOptions = { url: '/pdf-with-added-attachment' };
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

	it('exposes Response-Type but omits its header by default', async () => {
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

		const request: IHttpRequestOptions = {
			url: '/pdf-with-added-attachment',
			headers: { Accept: 'application/json', 'Response-Type': 'requestId' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes file and resource-ID attachment input branches', () => {
		const publicDefinition = JSON.stringify(addAttachmentDescription);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).toContain('Attachment Input Source');
		expect(publicDefinition).toContain('file_to_attach');
		expect(publicDefinition).not.toContain('"property":"file"');

		const bodyProperties = addAttachmentDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'id_to_attach', 'file_to_attach', 'output']);
	});
});
