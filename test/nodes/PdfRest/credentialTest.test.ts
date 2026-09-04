import { describe, expect, it, vi } from 'vitest';
import type { ICredentialTestFunctions, ICredentialsDecrypted } from 'n8n-workflow';
import { testPdfRestCredentials } from '../../../nodes/PdfRest/credentialTest';
import { PDFREST_BASE_URL_ERROR_MESSAGE } from '../../../nodes/PdfRest/helpers/baseUrl';

const credentials: ICredentialsDecrypted = {
	id: 'credential-id',
	name: 'pdfRest account',
	type: 'pdfRestApi',
	data: {
		apiKey: 'test-key',
		baseUrl: 'https://api.pdfrest.com/',
	},
};

function createContext(httpRequest: ReturnType<typeof vi.fn>): ICredentialTestFunctions {
	return {
		helpers: { httpRequest },
	} as unknown as ICredentialTestFunctions;
}

describe('testPdfRestCredentials', () => {
	it('accepts the authenticated not-found response for the sentinel request ID', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 404,
			body: {
				error:
					'requestID not found. Please check that the Api-Key and requestId are correct.',
			},
		});

		await expect(testPdfRestCredentials.call(createContext(httpRequest), credentials)).resolves.toEqual({
			status: 'OK',
			message: 'Connection successful',
		});
		expect(httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.pdfrest.com/request-status/00000000-0000-0000-0000-000000000000',
				headers: expect.objectContaining({ 'Api-Key': 'test-key' }),
			}),
		);
	});

	it('tests a custom deployment URL when selected', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 404,
			body: { error: 'requestID not found.' },
		});
		const customCredentials: ICredentialsDecrypted = {
			...credentials,
			data: {
				...credentials.data,
				baseUrl: 'custom',
				customBaseUrl: 'https://pdfrest.internal.example.com/',
			},
		};

		await expect(
			testPdfRestCredentials.call(createContext(httpRequest), customCredentials),
		).resolves.toEqual({
			status: 'OK',
			message: 'Connection successful',
		});
		expect(httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://pdfrest.internal.example.com/request-status/00000000-0000-0000-0000-000000000000',
				headers: { Accept: 'application/json' },
			}),
		);
	});

	it.each([
		'not-a-url',
		'file:///tmp/pdfrest',
		'https://user:password@pdfrest.internal.example.com',
		'https://pdfrest.internal.example.com?apiKey=secret',
		'https://pdfrest.internal.example.com#private',
	])('rejects malformed or credential-bearing custom URL %s', async (customBaseUrl) => {
		const httpRequest = vi.fn();
		const customCredentials: ICredentialsDecrypted = {
			...credentials,
			data: { baseUrl: 'custom', customBaseUrl },
		};

		await expect(
			testPdfRestCredentials.call(createContext(httpRequest), customCredentials),
		).resolves.toEqual({
			status: 'Error',
			message: PDFREST_BASE_URL_ERROR_MESSAGE,
		});
		expect(httpRequest).not.toHaveBeenCalled();
	});

	it('rejects an invalid API key', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 401,
			body: { error: 'The provided key is not valid.' },
		});

		await expect(testPdfRestCredentials.call(createContext(httpRequest), credentials)).resolves.toEqual({
			status: 'Error',
			message: 'The API key is invalid',
		});
	});

	it('rejects an unexpected response from the configured base URL', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 404,
			body: { error: 'Unknown endpoint' },
		});

		await expect(testPdfRestCredentials.call(createContext(httpRequest), credentials)).resolves.toEqual({
			status: 'Error',
			message: 'Unknown endpoint',
		});
	});

	it('returns a sanitized error when the request cannot be completed', async () => {
		const httpRequest = vi.fn().mockRejectedValue(new Error('request headers include a secret'));

		await expect(testPdfRestCredentials.call(createContext(httpRequest), credentials)).resolves.toEqual({
			status: 'Error',
			message: 'Could not connect to the configured pdfRest API Base URL',
		});
	});
});
