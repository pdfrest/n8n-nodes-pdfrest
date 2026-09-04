import type { INodePropertyOptions } from 'n8n-workflow';
import { createRasterConversionDescription } from '../helpers/rasterConversion';
import { createResourceIdOperation } from '../helpers/resourceId';

export const convertGifOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to GIF Images',
	value: 'convertGif',
	action: 'Convert · PDF to GIF Images',
	description: 'Convert each page of a PDF into a separate GIF image file',
	path: '/gif',
});

export const convertGifDescription = createRasterConversionDescription({
	operation: 'convertGif',
	colorModels: [
		{
			name: 'RGB',
			value: 'rgb',
		},
		{
			name: 'Grayscale',
			value: 'gray',
		},
	],
});
