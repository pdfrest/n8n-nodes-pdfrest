import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const convertPowerPointOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to Microsoft PowerPoint',
	value: 'convertPowerPoint',
	action: 'Convert · PDF to PowerPoint (PPTX)',
	description: 'Convert a PDF into a Microsoft PowerPoint presentation',
	path: '/powerpoint',
});

export const convertPowerPointDescription: INodeProperties[] = [
	createResourceIdField('convertPowerPoint'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['convertPowerPoint'],
			},
		},
		options: [
			createIncludeFileInfoField('convertPowerPoint'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PowerPoint file without an extension',
			}),
			createResponseTypeField('convertPowerPoint'),
		],
	},
];
