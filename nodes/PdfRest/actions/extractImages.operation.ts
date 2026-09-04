import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const extractImagesOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Extract Embedded Images from PDF',
	value: 'extractImages',
	action: 'Extract · Images from PDF',
	description: 'Extract embedded images from selected PDF pages in their original image formats',
	path: '/extracted-images',
});

export const extractImagesDescription: INodeProperties[] = [
	createResourceIdField('extractImages'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['extractImages'],
			},
		},
		options: [
			createIncludeFileInfoField('extractImages'),
			{
				displayName: 'Output File Name',
				name: 'output',
				type: 'string',
				default: '',
				description: 'The prefix for generated image file names without a file extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
					},
				},
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'string',
				default: '1-last',
				placeholder: 'e.g. 1,2,5-10,12-last',
				description: 'The pages from which to extract embedded images',
				routing: {
					send: {
						type: 'body',
						property: 'pages',
					},
				},
			},
			createResponseTypeField('extractImages'),
		],
	},
];
