import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	deleteResourceDescription,
	deleteResourceOperation,
} from '../../../../nodes/PdfRest/actions/deleteResource.operation';

describe('Delete Resource operation', () => {
	it('uses the OpenAPI operation identity and interpolated DELETE route', () => {
		expect(deleteResourceOperation).toMatchObject({
			name: 'Delete Resource by ID',
			value: 'deleteResource',
			action: 'Files · Delete File by ID',
			routing: {
				request: {
					method: 'DELETE',
					url: '=/resource/{{$parameter.resourceId}}',
				},
			},
		});
		expect(deleteResourceOperation.routing?.request?.url).toContain(
			'{{$parameter.resourceId}}',
		);
	});

	it('requires the resource ID declared by the path parameter', () => {
		const resourceId = deleteResourceDescription.find(({ name }) => name === 'resourceId');
		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['deleteResource'] } },
		});
		expect(resourceId?.routing).toBeUndefined();
	});

	it('groups Include File Info in Optional Fields and routes its false default', async () => {
		const optionalFields = deleteResourceDescription.find(({ name }) => name === 'options');
		const includeFileInfo = optionalFields?.options?.find(
			({ name }) => name === 'includeFileInfo',
		);

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['deleteResource'] } },
		});
		expect(optionalFields?.options?.map(({ name }) => name)).toEqual(['includeFileInfo']);
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			name: 'includeFileInfo',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(includeFileInfo?.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/resource/example-id' };
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

	it('exposes exactly the declared parameters without a request body', () => {
		expect(deleteResourceDescription.map(({ name }) => name)).toEqual([
			'resourceId',
			'options',
		]);
		const publicDefinition = JSON.stringify(deleteResourceDescription);
		expect(publicDefinition).not.toContain('responseType');
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('"property":"file"');

		const request = deleteResourceOperation.routing?.request;
		expect(request).not.toHaveProperty('body');
		expect(request?.headers).toBeUndefined();
		expect(
			deleteResourceDescription.some(
				(field) =>
					field.routing?.send?.type === 'body' ||
					field.options?.some((option) => option.routing?.send?.type === 'body'),
			),
		).toBe(false);
	});
});
