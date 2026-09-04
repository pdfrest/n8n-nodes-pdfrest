import { NodeConnectionTypes } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { createResourceIdOperation } from '../../../../nodes/PdfRest/helpers/resourceId';

describe('resource ID operation', () => {
	it('preserves all option metadata while adding the shared request routing', () => {
		const operation = createResourceIdOperation({
			name: 'Convert BMP to PDF',
			value: 'convertBmp',
			action: 'Convert · BMP to PDF',
			description: 'Convert a BMP image into a PDF document',
			disabled: true,
			builderHint: {
				propertyHint: 'Choose the PDF conversion action',
				placeholderSupported: true,
			},
			outputConnectionType: NodeConnectionTypes.Main,
			inputSchema: { type: 'object' },
			displayOptions: { show: { mode: ['convert'] } },
			path: '/bmp',
		});

		expect(operation).toEqual({
			name: 'Convert BMP to PDF',
			value: 'convertBmp',
			action: 'Convert · BMP to PDF',
			description: 'Convert a BMP image into a PDF document',
			disabled: true,
			builderHint: {
				propertyHint: 'Choose the PDF conversion action',
				placeholderSupported: true,
			},
			outputConnectionType: NodeConnectionTypes.Main,
			inputSchema: { type: 'object' },
			displayOptions: { show: { mode: ['convert'] } },
			routing: {
				request: {
					method: 'POST',
					url: '/bmp',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});
});
