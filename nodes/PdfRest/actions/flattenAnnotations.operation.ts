import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const flattenAnnotationsOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Flatten PDF Annotations',
	value: 'flattenAnnotations',
	action: 'Optimize · Flatten Annotations',
	description: 'Merge annotation appearances into PDF page content so they are no longer editable',
	path: '/flattened-annotations-pdf',
});

export const flattenAnnotationsDescription: INodeProperties[] = [
	createResourceIdField('flattenAnnotations'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['flattenAnnotations'],
			},
		},
		options: [
			createIncludeFileInfoField('flattenAnnotations'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated flattened PDF without an extension',
			}),
			createResponseTypeField('flattenAnnotations'),
		],
	},
];
