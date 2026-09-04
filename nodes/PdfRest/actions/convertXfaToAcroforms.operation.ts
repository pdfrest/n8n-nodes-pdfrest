import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const convertXfaToAcroformsOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert XFA Forms to AcroForms',
	value: 'convertXfaToAcroforms',
	action: 'Forms · XFA to AcroForms',
	description: 'Convert XFA forms to widely supported and editable AcroForms',
	path: '/pdf-with-acroforms',
});

export const convertXfaToAcroformsDescription: INodeProperties[] = [
	createResourceIdField('convertXfaToAcroforms'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['convertXfaToAcroforms'],
			},
		},
		options: [
			createIncludeFileInfoField('convertXfaToAcroforms'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated AcroForms PDF without an extension',
			}),
			createResponseTypeField('convertXfaToAcroforms'),
		],
	},
];
