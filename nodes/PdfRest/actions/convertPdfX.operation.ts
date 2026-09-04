import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const convertPdfXOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to PDF/X',
	value: 'convertPdfX',
	action: 'Convert · PDF to PDF/X (Print)',
	description: 'Convert a PDF to a selected PDF/X standard for professional print workflows',
	path: '/pdfx',
});

export const convertPdfXDescription: INodeProperties[] = [
	createResourceIdField('convertPdfX'),
	{
		displayName: 'PDF/X Version',
		name: 'pdfXVersion',
		type: 'options',
		options: [
			{ name: 'PDF/X-1a', value: 'PDF/X-1a' },
			{ name: 'PDF/X-3', value: 'PDF/X-3' },
			{ name: 'PDF/X-4', value: 'PDF/X-4' },
			{ name: 'PDF/X-6', value: 'PDF/X-6' },
		],
		default: 'PDF/X-1a',
		required: true,
		displayOptions: {
			show: {
				operation: ['convertPdfX'],
			},
		},
		description: 'The PDF/X standard to use for the generated document',
		routing: {
			send: {
				type: 'body',
				property: 'output_type',
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
				operation: ['convertPdfX'],
			},
		},
		options: [
			createIncludeFileInfoField('convertPdfX'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PDF/X file without an extension',
			}),
			createResponseTypeField('convertPdfX'),
		],
	},
];
