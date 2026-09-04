import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const flattenLayersOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Flatten PDF Layers',
	value: 'flattenLayers',
	action: 'Optimize · Flatten Layers',
	description: 'Collapse content from all PDF layers onto a single layer',
	path: '/flattened-layers-pdf',
});

export const flattenLayersDescription: INodeProperties[] = [
	createResourceIdField('flattenLayers'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['flattenLayers'] } },
		options: [
			createIncludeFileInfoField('flattenLayers'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated flattened PDF without an extension',
			}),
			createResponseTypeField('flattenLayers'),
		],
	},
];
