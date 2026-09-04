import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import {
	createContentFilenameField,
	createIncludeFileInfoField,
	createResponseTypeField,
} from '../../../../nodes/PdfRest/helpers/headers';

describe('pdfRest header fields', () => {
	it('routes Include-File-Info with the OpenAPI boolean default', async () => {
		const field = createIncludeFileInfoField('split');
		expect(field).toMatchObject({
			displayName: 'Include File Info',
			name: 'includeFileInfo',
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		expect(field.displayOptions).toBeUndefined();
		expect(field.routing?.send?.preSend).toHaveLength(1);

		const request: IHttpRequestOptions = { url: '/split-pdf' };
		const getNodeParameter = vi.fn(() => false);
		await field.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter } as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(getNodeParameter).toHaveBeenCalledWith('options.includeFileInfo');
		expect(request.headers).toEqual({ 'Include-File-Info': false });
	});

	it('omits Response-Type by default and sends the asynchronous value when selected', async () => {
		const field = createResponseTypeField('split');
		expect(field).toMatchObject({
			displayName: 'Response Type',
			name: 'responseType',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
			routing: { send: {} },
		});
		expect(field.displayOptions).toBeUndefined();

		const preSend = field.routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();
		const blankRequest: IHttpRequestOptions = {
			url: '/split-pdf',
			headers: { 'Response-Type': '', Accept: 'application/json' },
		};
		const getSynchronousResponseType = vi.fn(() => '');
		await preSend?.call(
			{ getNodeParameter: getSynchronousResponseType } as unknown as IExecuteSingleFunctions,
			blankRequest,
		);
		expect(getSynchronousResponseType).toHaveBeenCalledWith('options.responseType');
		expect(blankRequest.headers).toEqual({ Accept: 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = {
			url: '/split-pdf',
			headers: { 'Response-Type': 'requestId' },
		};
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('creates Content-Filename routing without exposing it from an operation', async () => {
		const field = createContentFilenameField('upload');
		expect(field).toMatchObject({
			displayName: 'Content Filename',
			name: 'contentFilename',
			type: 'string',
			default: '',
			displayOptions: { show: { operation: ['upload'] } },
			routing: { send: {} },
		});

		const request: IHttpRequestOptions = {
			url: '/upload',
			headers: { 'Content-Filename': '   ' },
		};
		const getContentFilename = vi.fn(() => '   ');
		await field.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: getContentFilename } as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(getContentFilename).toHaveBeenCalledWith('options.contentFilename');
		expect(request.headers).toEqual({});
	});
});
