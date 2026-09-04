import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const convertExcelOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to Microsoft Excel',
	value: 'convertExcel',
	action: 'Convert · PDF to Excel (XLSX)',
	description: 'Convert a PDF into an editable Microsoft Excel document',
	path: '/excel',
});

export const convertExcelDescription: INodeProperties[] = [
	createResourceIdField('convertExcel'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['convertExcel'],
			},
		},
		options: [
			createIncludeFileInfoField('convertExcel'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name for the generated Excel file without a file extension',
			}),
			createResponseTypeField('convertExcel'),
		],
	},
];
