import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const convertPdfAOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to PDF/A',
	value: 'convertPdfA',
	action: 'Convert · PDF to PDF/A (Archival)',
	description: 'Convert a PDF to a selected PDF/A conformance level for long-term archiving',
	path: '/pdfa',
});

export const convertPdfADescription: INodeProperties[] = [
	createResourceIdField('convertPdfA'),
	{
		displayName: 'PDF/A Version',
		name: 'pdfAVersion',
		type: 'options',
		options: [
			{ name: 'PDF/A-1b', value: 'PDF/A-1b' },
			{ name: 'PDF/A-2b', value: 'PDF/A-2b' },
			{ name: 'PDF/A-2u', value: 'PDF/A-2u' },
			{ name: 'PDF/A-3b', value: 'PDF/A-3b' },
			{ name: 'PDF/A-3u', value: 'PDF/A-3u' },
		],
		default: 'PDF/A-1b',
		required: true,
		displayOptions: {
			show: {
				operation: ['convertPdfA'],
			},
		},
		description: 'The PDF/A conformance level for the output document',
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
				operation: ['convertPdfA'],
			},
		},
		options: [
			createIncludeFileInfoField('convertPdfA'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PDF/A file without an extension',
			}),
			{
				displayName: 'Rasterize If Errors Encountered',
				name: 'rasterizeIfErrorsEncountered',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				description: 'Choose whether to rasterize pages when conversion errors occur',
				routing: {
					send: {
						type: 'body',
						property: 'rasterize_if_errors_encountered',
					},
				},
			},
			createResponseTypeField('convertPdfA'),
		],
	},
];
