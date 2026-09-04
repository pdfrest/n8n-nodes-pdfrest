import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const convertWordOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to Microsoft Word',
	value: 'convertWord',
	action: 'Convert · PDF to Word (DOCX)',
	description: 'Convert a PDF into an editable Microsoft Word document',
	path: '/word',
});

export const convertWordDescription: INodeProperties[] = [
	createResourceIdField('convertWord'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['convertWord'],
			},
		},
		options: [
			createIncludeFileInfoField('convertWord'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated Word file without an extension',
			}),
			createResponseTypeField('convertWord'),
		],
	},
];
