import type { INodePropertyOptions } from 'n8n-workflow';
import { createRasterConversionDescription } from '../helpers/rasterConversion';
import { createResourceIdOperation } from '../helpers/resourceId';

export const convertBmpOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to BMP Images',
	value: 'convertBmp',
	action: 'Convert · PDF to BMP Images',
	description: 'Convert each page of a PDF into a separate BMP image file',
	path: '/bmp',
});

export const convertBmpDescription = createRasterConversionDescription({
	operation: 'convertBmp',
	colorModels: [
		{ name: 'RGB', value: 'rgb' },
		{ name: 'Grayscale', value: 'gray' },
	],
});
