import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField } from '../helpers/resourceId';

const individualQueryOptions: INodeProperties['options'] = [
	{ name: 'Author', value: 'author' },
	{ name: 'Contains AcroForms', value: 'contains_acroforms' },
	{ name: 'Contains Annotations', value: 'contains_annotations' },
	{ name: 'Contains Embedded File', value: 'contains_embedded_file' },
	{ name: 'Contains JavaScript', value: 'contains_javascript' },
	{ name: 'Contains Signature', value: 'contains_signature' },
	{ name: 'Contains Transparency', value: 'contains_transparency' },
	{ name: 'Contains XFA', value: 'contains_xfa' },
	{ name: 'Creation Date', value: 'creation_date' },
	{ name: 'Creator', value: 'creator' },
	{ name: 'Custom Metadata', value: 'custom_metadata' },
	{ name: 'Document Language', value: 'doc_language' },
	{ name: 'File Size', value: 'file_size' },
	{ name: 'Filename', value: 'filename' },
	{ name: 'Image Only', value: 'image_only' },
	{ name: 'Keywords', value: 'keywords' },
	{ name: 'Modified Date', value: 'modified_date' },
	{ name: 'Page Boxes', value: 'page_boxes' },
	{ name: 'Page Count', value: 'page_count' },
	{ name: 'PDF/A', value: 'pdfa' },
	{ name: 'PDF/E Claim', value: 'pdfe_claim' },
	{ name: 'PDF/UA Claim', value: 'pdfua_claim' },
	{ name: 'PDF Version', value: 'pdf_version' },
	{ name: 'PDF/VT Claim', value: 'pdfvt_claim' },
	{ name: 'PDF/X Claim', value: 'pdfx_claim' },
	{ name: 'Producer', value: 'producer' },
	{ name: 'Requires Password to Open', value: 'requires_password_to_open' },
	{ name: 'Restrictions Set', value: 'restrict_permissions_set' },
	{ name: 'Subject', value: 'subject' },
	{ name: 'Tagged', value: 'tagged' },
	{ name: 'Title', value: 'title' },
	{ name: 'Uses Embedded Fonts', value: 'uses_embedded_fonts' },
	{ name: 'Uses Non-Embedded Fonts', value: 'uses_nonembedded_fonts' },
];

export const pdfInfoOperation: INodePropertyOptions = {
	name: 'Query PDF Metadata and Document Properties',
	value: 'pdfInfo',
	action: 'Extract · Query PDF Info (Metadata)',
	description: 'Inspect a PDF for detailed metadata, security, forms, fonts, images, and other document properties',
	routing: {
		request: {
			method: 'POST',
			url: '/pdf-info',
			headers: {
				'Content-Type': 'application/json',
			},
		},
	},
};

export const pdfInfoDescription: INodeProperties[] = [
	createResourceIdField('pdfInfo'),
	{
		displayName: 'Queries',
		name: 'queries',
		type: 'options',
		options: [
			{
				name: 'All Queries',
				value: 'all',
			},
			{
				name: 'Select Queries',
				value: 'selected',
			},
		],
		default: 'all',
		required: true,
		displayOptions: {
			show: {
				operation: ['pdfInfo'],
			},
		},
		description: 'Choose whether to run every supported query or select individual queries',
		routing: {
			send: {
				type: 'body',
				property: 'queries',
				value:
					"={{ $value === 'all' ? 'all' : $parameter.selectedQueries.join(',') }}",
			},
		},
	},
	{
		displayName: 'Selected Queries',
		name: 'selectedQueries',
		type: 'multiOptions',
		options: individualQueryOptions,
		default: ['tagged', 'image_only', 'creation_date', 'modified_date', 'doc_language'],
		required: true,
		displayOptions: {
			show: {
				operation: ['pdfInfo'],
				queries: ['selected'],
			},
		},
		description: 'The document properties and metadata to retrieve',
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['pdfInfo'],
			},
		},
		options: [createIncludeFileInfoField('pdfInfo'), createResponseTypeField('pdfInfo')],
	},
];
