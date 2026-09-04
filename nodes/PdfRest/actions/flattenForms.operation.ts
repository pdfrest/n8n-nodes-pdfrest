import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const flattenFormsOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Flatten PDF Forms',
	value: 'flattenForms',
	action: 'Forms · Flatten PDF Forms',
	description: 'Make XFA and AcroForm fields non-editable while preserving their data and appearance',
	path: '/flattened-forms-pdf',
});

export const flattenFormsDescription: INodeProperties[] = [
	createResourceIdField('flattenForms'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['flattenForms'] } },
		options: [
			{
				displayName: 'Appearance',
				name: 'asPrinted',
				type: 'options',
				options: [
					{ name: 'On-Screen', value: 'false' },
					{ name: 'Printed', value: 'true' },
				],
				default: 'false',
				description: 'Choose whether to flatten forms using their on-screen or print appearance',
				routing: { send: { type: 'body', property: 'as_printed' } },
			},
			createIncludeFileInfoField('flattenForms'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated flattened PDF without an extension',
			}),
			createResponseTypeField('flattenForms'),
		],
	},
];
