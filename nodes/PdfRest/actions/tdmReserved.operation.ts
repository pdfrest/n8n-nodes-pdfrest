import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const tdmReservedOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Apply TDM Reservation Policy to PDF',
	value: 'tdmReserved',
	action: 'Secure · TDM Reserve PDF',
	description: 'Embed a machine-readable policy in a PDF to reserve its text and data mining rights',
	path: '/tdm-reserved-pdf',
});

export const tdmReservedDescription: INodeProperties[] = [
	createResourceIdField('tdmReserved'),
	{
		...createNonEmptyBodyStringField({
			displayName: 'Policy',
			name: 'policy',
			bodyProperty: 'policy',
			description: 'The hosted terms of use or machine-readable TDM policy to embed in the PDF',
		}),
		default: 'https://example.com/tdm-policy',
		required: true,
		displayOptions: {
			show: {
				operation: ['tdmReserved'],
			},
		},
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['tdmReserved'],
			},
		},
		options: [
			createIncludeFileInfoField('tdmReserved'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated TDM-reserved PDF without an extension',
			}),
			createResponseTypeField('tdmReserved'),
		],
	},
];
