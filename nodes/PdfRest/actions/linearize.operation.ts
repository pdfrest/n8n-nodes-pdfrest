import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const linearizeOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Linearize PDF',
	value: 'linearize',
	action: 'Optimize · Linearize PDF (Fast Web View)',
	description: 'Restructure a PDF for fast web viewing so pages can load progressively',
	path: '/linearized-pdf',
});

export const linearizeDescription: INodeProperties[] = [
	createResourceIdField('linearize'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['linearize'],
			},
		},
		options: [
			createIncludeFileInfoField('linearize'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated linearized PDF without an extension',
			}),
			createResponseTypeField('linearize'),
		],
	},
];
