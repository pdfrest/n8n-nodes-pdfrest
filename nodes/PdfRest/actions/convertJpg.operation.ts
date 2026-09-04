import type { INodePropertyOptions } from 'n8n-workflow';
import { createRasterConversionDescription } from '../helpers/rasterConversion';
import { createResourceIdOperation } from '../helpers/resourceId';

export const convertJpgOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to JPEG Images',
	value: 'convertJpg',
	action: 'Convert · PDF to JPG Images (JPEG)',
	description: 'Convert each page of a PDF into a separate JPEG image file',
	path: '/jpg',
});

export const convertJpgDescription = createRasterConversionDescription({
	operation: 'convertJpg',
	colorModels: [
		{ name: 'RGB', value: 'rgb' },
		{ name: 'CMYK', value: 'cmyk' },
		{ name: 'Grayscale', value: 'gray' },
	],
	includeJpegQuality: true,
});
