import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const rasterizeOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Rasterize PDF',
	value: 'rasterize',
	action: 'Optimize · Rasterize PDF',
	description: 'Convert each PDF page to a flattened image for consistent rendering and printing',
	path: '/rasterized-pdf',
});

export const rasterizeDescription: INodeProperties[] = [
	createResourceIdField('rasterize'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['rasterize'],
			},
		},
		options: [
			createIncludeFileInfoField('rasterize'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated rasterized PDF without an extension',
			}),
			createResponseTypeField('rasterize'),
		],
	},
];
