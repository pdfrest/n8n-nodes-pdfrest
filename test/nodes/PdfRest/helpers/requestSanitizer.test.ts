import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { createPdfRestRequestSanitizer } from '../../../../nodes/PdfRest/helpers/requestSanitizer';

describe('createPdfRestRequestSanitizer', () => {
	it('removes blank parameters and repeated-field entries', async () => {
		const requestOptions: IHttpRequestOptions = {
			url: '/upload',
			body: {
				url: ['https://example.com/document.pdf', '', '   ', []],
				output: '',
				includeFileInfo: false,
				pageLimit: 0,
				settings: {},
			},
			qs: {
				requestId: '',
				verbose: false,
			},
		};

		const result = await createPdfRestRequestSanitizer().call(
			{} as IExecuteSingleFunctions,
			requestOptions,
		);

		expect(result.body).toEqual({
			url: ['https://example.com/document.pdf'],
			includeFileInfo: false,
			pageLimit: 0,
			settings: {},
		});
		expect(result.qs).toEqual({ verbose: false });
	});

	it('does not alter multipart bodies', async () => {
		const formData = new FormData();
		formData.append('url', '');
		const requestOptions: IHttpRequestOptions = { url: '/upload', body: formData };

		const result = await createPdfRestRequestSanitizer().call(
			{} as IExecuteSingleFunctions,
			requestOptions,
		);

		expect(result.body).toBe(formData);
	});
});
