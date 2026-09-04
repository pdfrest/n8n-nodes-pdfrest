import type { INodePropertyOptions } from 'n8n-workflow';
import { createRasterConversionDescription } from '../helpers/rasterConversion';
import { createResourceIdOperation } from '../helpers/resourceId';

export const convertTifOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to TIFF Images',
	value: 'convertTif',
	action: 'Convert · PDF to TIFF Images',
	description: 'Convert each page of a PDF into a separate TIFF image file',
	path: '/tif',
});

export const convertTifDescription = createRasterConversionDescription({
	operation: 'convertTif',
	colorModels: [
		{ name: 'RGB', value: 'rgb' },
		{ name: 'RGBA', value: 'rgba' },
		{ name: 'CMYK', value: 'cmyk' },
		{ name: 'CIELAB', value: 'lab' },
		{ name: 'Grayscale', value: 'gray' },
	],
});
