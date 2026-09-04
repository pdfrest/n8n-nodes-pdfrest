import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	deleteResourcesDescription,
	deleteResourcesOperation,
} from '../../../../nodes/PdfRest/actions/deleteResources.operation';

describe('Delete Files operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(deleteResourcesOperation).toMatchObject({
			name: 'Delete One or More Resource Files by ID',
			value: 'deleteResources',
			action: 'Files · Delete Files by ID',
			routing: {
				request: {
					method: 'POST',
					url: '/delete',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required non-empty resource ID example to the exact ids body property', () => {
		const resourceIds = deleteResourcesDescription.find(
			(field) => field.name === 'resourceIds',
		);

		expect(resourceIds).toMatchObject({
			displayName: 'Resource IDs',
			type: 'string',
			default:
				'0950b9bd-f046-4d3f-8ea3-d2894f1ae839, 12f7ea0d-0e56-44bc-a3d2-42fdff96d993',
			required: true,
			displayOptions: { show: { operation: ['deleteResources'] } },
			routing: { send: { type: 'body', property: 'ids' } },
		});
		expect(resourceIds?.default).toBeTypeOf('string');
		expect((resourceIds?.default as string).length).toBeGreaterThanOrEqual(1);
	});

	it('places the optional headers in alphabetical order', () => {
		const optionalFields = deleteResourcesDescription.find((field) => field.name === 'options');

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['deleteResources'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'responseType',
		]);
	});

	it('sends Include-File-Info with its false OpenAPI default', async () => {
		const optionalFields = deleteResourcesDescription.find((field) => field.name === 'options');
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);

		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});

		const request: IHttpRequestOptions = { url: '/delete' };
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

	it('omits Response-Type by default and sends requestId when selected', async () => {
		const optionalFields = deleteResourcesDescription.find((field) => field.name === 'options');
		const responseType = optionalFields?.options?.find((field) => field.name === 'responseType');

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

		const preSend = responseType?.routing?.send?.preSend?.[0];
		const synchronousRequest: IHttpRequestOptions = {
			url: '/delete',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/delete' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('does not expose undeclared or binary-file parameters', () => {
		const publicDefinition = JSON.stringify(deleteResourcesDescription);
		const optionalFields = deleteResourcesDescription.find((field) => field.name === 'options');

		expect(deleteResourcesDescription.map((field) => field.name)).toEqual([
			'resourceIds',
			'options',
		]);
		expect(optionalFields?.options).toHaveLength(2);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('contentFilename');
	});
});
