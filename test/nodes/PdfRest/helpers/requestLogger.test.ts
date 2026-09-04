import type { IExecuteSingleFunctions } from 'n8n-workflow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createPdfRestRequestLogger,
	PDFREST_REQUEST_MANIFEST_PREFIX,
} from '../../../../nodes/PdfRest/helpers/requestLogger';

describe('createPdfRestRequestLogger', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does not log during ordinary node execution', async () => {
		const debug = vi.fn();
		const requestOptions = { method: 'GET' as const, url: '/resource/customer-resource-id' };
		const executionContext = {
			getNodeParameter: () => false,
			logger: { debug },
		} as unknown as IExecuteSingleFunctions;

		const result = await createPdfRestRequestLogger().call(executionContext, requestOptions);

		expect(result).toBe(requestOptions);
		expect(debug).not.toHaveBeenCalled();
	});

	it('logs safe CI field metadata without exposing request values or routes', async () => {
		const debug = vi.fn();
		const requestOptions = {
			method: 'POST' as const,
			url: '/request-status/customer-request-id',
			headers: {
				'Api-Key': 'secret',
				Accept: 'application/json',
				'Response-Type': 'requestId',
			},
			body: {
				file: 'data',
				url: 'https://example.com/secret-document.pdf',
				options: { confidential: true },
			},
			qs: { page: 2 },
		};
		const executionContext = {
			getNodeParameter: (name: string) =>
				name === 'requestDiagnostics' ? true : name === 'operation' ? 'getRequestStatus' : undefined,
			getInputData: () => ({
				json: {},
				binary: {
					data: {
						data: 'filesystem-v2',
						mimeType: 'application/pdf',
						fileName: 'input.pdf',
						bytes: 123,
					},
				},
			}),
			getItemIndex: () => 0,
			getNode: () => ({ name: 'Upload PDF' }),
			logger: { debug },
		} as unknown as IExecuteSingleFunctions;

		const result = await createPdfRestRequestLogger().call(
			executionContext,
			requestOptions,
		);

		expect(result).toBe(requestOptions);
		expect(debug).toHaveBeenCalledOnce();
		const line = String(debug.mock.calls[0]?.[0]);
		expect(line.startsWith(PDFREST_REQUEST_MANIFEST_PREFIX)).toBe(true);
		expect(JSON.parse(line.slice(PDFREST_REQUEST_MANIFEST_PREFIX.length))).toEqual({
			node: 'Upload PDF',
			itemIndex: 0,
			method: 'POST',
			operation: 'getRequestStatus',
			inputs: [
				{
					location: 'body',
					name: 'file',
					type: 'inputFile',
					binaryField: 'data',
					mimeType: 'application/pdf',
					bytes: 123,
				},
				{ location: 'body', name: 'url', type: 'string' },
				{ location: 'body', name: 'options', type: 'object' },
				{ location: 'query', name: 'page', type: 'number' },
				{ location: 'header', name: 'Response-Type', type: 'string' },
			],
		});
		expect(line).not.toContain('secret');
		expect(line).not.toContain('Api-Key');
		expect(line).not.toContain('customer-request-id');
		expect(line).not.toContain('secret-document.pdf');
		expect(line).not.toContain('input.pdf');
	});
});
