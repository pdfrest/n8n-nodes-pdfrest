import type { INodePropertyOptions } from 'n8n-workflow';
import { createRasterConversionDescription } from '../helpers/rasterConversion';
import { createResourceIdOperation } from '../helpers/resourceId';

export const convertPngOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to PNG Images',
	value: 'convertPng',
	action: 'Convert · PDF to PNG Images',
	description: 'Convert each page of a PDF into a separate PNG image file',
	path: '/png',
});

export const convertPngDescription = createRasterConversionDescription({
	operation: 'convertPng',
	colorModels: [
		{ name: 'RGB', value: 'rgb' },
		{ name: 'RGBA', value: 'rgba' },
		{ name: 'Grayscale', value: 'gray' },
	],
});
