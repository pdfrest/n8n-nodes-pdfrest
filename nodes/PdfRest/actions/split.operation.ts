import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const splitOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Split PDF into Multiple Files',
	value: 'split',
	action: 'Modify · Split PDF',
	description: 'Split a PDF into separate files using page numbers, ranges, or page selectors',
	path: '/split-pdf',
});

export const splitDescription: INodeProperties[] = [
	createResourceIdField('split'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['split'],
			},
		},
		options: [
			createIncludeFileInfoField('split'),
			{
				displayName: 'Output File Name',
				name: 'output',
				type: 'string',
				default: '',
				description: 'The name for generated files without a file extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
					},
				},
			},
			{
				displayName: 'Page Ranges',
				name: 'pageRanges',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Page Range',
				},
				default: [],
				placeholder: 'e.g. 1-3,5 or even',
				description:
					'Add one range for each output PDF or omit this field to create one PDF per input page',
				routing: {
					send: {
						type: 'body',
						property: 'pages[]',
						propertyInDotNotation: false,
					},
				},
			},
			createResponseTypeField('split'),
		],
	},
];
