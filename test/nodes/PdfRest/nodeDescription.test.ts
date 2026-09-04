import { describe, expect, it } from 'vitest';
import { PdfRest } from '../../../nodes/PdfRest/PdfRest.node';

describe('pdfRest node description', () => {
	it('uses the public pdfRest API Toolkit display name', () => {
		const node = new PdfRest();

		expect(node.description.displayName).toBe('pdfRest API Toolkit');
		expect(node.description.defaults.name).toBe('pdfRest API Toolkit');
		expect(node.description.name).toBe('pdfRest');
	});
});
