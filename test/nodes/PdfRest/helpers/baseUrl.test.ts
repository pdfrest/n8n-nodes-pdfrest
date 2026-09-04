import { describe, expect, it } from 'vitest';
import {
	getPdfRestBaseUrl,
	normalizePdfRestRequestUrl,
	PDFREST_BASE_URL_ERROR_MESSAGE,
} from '../../../../nodes/PdfRest/helpers/baseUrl';

describe('getPdfRestBaseUrl', () => {
	it('returns hosted and legacy base URL values without trailing slashes', () => {
		expect(getPdfRestBaseUrl({ baseUrl: 'https://eu-api.pdfrest.com/' })).toBe(
			'https://eu-api.pdfrest.com',
		);
		expect(getPdfRestBaseUrl({ baseUrl: 'https://legacy.example.com///' })).toBe(
			'https://legacy.example.com',
		);
	});

	it('returns the deployment URL when the custom option is selected', () => {
		expect(
			getPdfRestBaseUrl({
				baseUrl: 'custom',
				customBaseUrl: ' https://pdfrest.internal.example.com/api/// ',
			}),
		).toBe('https://pdfrest.internal.example.com/api');
	});

	it('allows HTTP for private custom deployments', () => {
		expect(
			getPdfRestBaseUrl({
				baseUrl: 'custom',
				customBaseUrl: 'http://pdfrest.internal:8080/',
			}),
		).toBe('http://pdfrest.internal:8080');
	});

	it.each([
		'pdfrest.internal.example.com',
		'ftp://pdfrest.internal.example.com',
		'https://user:password@pdfrest.internal.example.com',
		'https://pdfrest.internal.example.com?apiKey=secret',
		'https://pdfrest.internal.example.com#private',
	])('rejects unsafe deployment URL %s', (customBaseUrl) => {
		expect(() => getPdfRestBaseUrl({ baseUrl: 'custom', customBaseUrl })).toThrow(
			PDFREST_BASE_URL_ERROR_MESSAGE,
		);
	});

	it('normalizes the configured base URL in a complete request URL', () => {
		expect(
			normalizePdfRestRequestUrl('https://pdfrest.internal.example.com/api///compress', {
				baseUrl: 'custom',
				customBaseUrl: 'https://pdfrest.internal.example.com/api///',
			}),
		).toBe('https://pdfrest.internal.example.com/api/compress');
	});
});
