import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	requestStatusDescription,
	requestStatusOperation,
} from '../../../../nodes/PdfRest/actions/requestStatus.operation';

describe('Get Request Status operation', () => {
	it('uses the OpenAPI operation identity and interpolated GET route', () => {
		expect(requestStatusOperation).toMatchObject({
			name: 'Poll for an Async Request Result',
			value: 'getRequestStatus',
			action: 'Files · Poll for Request Status',
			routing: {
				request: {
					method: 'GET',
					url: '=/request-status/{{$parameter.requestId}}',
				},
			},
		});

		const request = requestStatusOperation.routing?.request;
		expect(request).not.toHaveProperty('body');
		expect(request?.headers).toBeUndefined();
	});

	it('requires a request ID and interpolates it into the path', () => {
		const requestId = requestStatusDescription.find((field) => field.name === 'requestId');

		expect(requestId).toMatchObject({
			displayName: 'Request ID',
			name: 'requestId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['getRequestStatus'] } },
		});
		expect(requestStatusOperation.routing?.request?.url).toContain(
			'{{$parameter.requestId}}',
		);
		expect(requestId?.routing).toBeUndefined();
	});

	it('sends Include-File-Info with its false OpenAPI default', async () => {
		const optionalFields = requestStatusDescription.find((field) => field.name === 'options');
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['getRequestStatus'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual(['includeFileInfo']);
		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(includeFileInfo?.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/request-status/example-request-id' };
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

	it('exposes no body, content type, Response Type, or binary-file input', () => {
		const publicDefinition = JSON.stringify(requestStatusDescription);
		const fieldNames = requestStatusDescription.map((field) => field.name);

		expect(fieldNames).toEqual(['requestId', 'options']);
		expect(publicDefinition).not.toContain('responseType');
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('binaryData');
		expect(requestStatusOperation.routing?.request).not.toHaveProperty('body');
		expect(requestStatusOperation.routing?.request?.headers).toBeUndefined();
		expect(
			requestStatusDescription.some(
				(field) =>
					field.routing?.send?.type === 'body' ||
					field.options?.some((option) => option.routing?.send?.type === 'body'),
			),
		).toBe(false);
	});
});
