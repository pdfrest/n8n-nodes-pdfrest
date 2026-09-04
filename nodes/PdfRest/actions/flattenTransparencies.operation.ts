import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const flattenTransparenciesOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Flatten PDF Transparencies',
	value: 'flattenTransparencies',
	action: 'Optimize · Flatten Transparencies',
	description: 'Flatten transparent PDF objects for prepress and workflows that do not support transparency',
	path: '/flattened-transparencies-pdf',
});

export const flattenTransparenciesDescription: INodeProperties[] = [
	createResourceIdField('flattenTransparencies'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['flattenTransparencies'],
			},
		},
		options: [
			createIncludeFileInfoField('flattenTransparencies'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PDF without an extension',
			}),
			{
				displayName: 'Quality',
				name: 'quality',
				type: 'options',
				options: [
					{ name: 'High', value: 'high' },
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
				],
				default: 'medium',
				description: 'The rendering quality for flattened transparent objects',
				routing: {
					send: {
						type: 'body',
						property: 'quality',
					},
				},
			},
			createResponseTypeField('flattenTransparencies'),
		],
	},
];
