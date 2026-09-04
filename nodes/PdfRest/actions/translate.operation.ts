import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const translateOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Translate PDF, Markdown, or Plain Text',
	value: 'translate',
	action: 'Analyze · Translate PDF (AI)',
	description: 'Translate PDF, Markdown, or plain-text content into a requested language using AI',
	path: '/translated-pdf-text',
});

export const translateDescription: INodeProperties[] = [
	createResourceIdField('translate'),
	{
		displayName: 'Output Language',
		name: 'outputLanguage',
		type: 'string',
		default: 'en',
		required: true,
		displayOptions: {
			show: {
				operation: ['translate'],
			},
		},
		description: 'The ISO 639 language code for the translated text',
		placeholder: 'e.g. en or zh-Hant',
		routing: {
			send: {
				type: 'body',
				property: 'output_language',
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
				operation: ['translate'],
			},
		},
		options: [
			createIncludeFileInfoField('translate'),
			{
				displayName: 'Output File Name',
				name: 'output',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						outputType: ['file'],
					},
				},
				description: 'The name for the translated file without a file extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
					},
				},
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Plain Text',
						value: 'plaintext',
					},
					{
						name: 'Markdown',
						value: 'markdown',
					},
				],
				default: 'markdown',
				description: 'Choose whether the translated text uses Markdown syntax',
				routing: {
					send: {
						type: 'body',
						property: 'output_format',
					},
				},
			},
			{
				displayName: 'Output Type',
				name: 'outputType',
				type: 'options',
				options: [
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				default: 'json',
				description: 'Choose whether to return a downloadable file or translated JSON',
				routing: {
					send: {
						type: 'body',
						property: 'output_type',
					},
				},
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'string',
				default: '1-last',
				placeholder: 'e.g. 1,2,5-10,12-last',
				description:
					'The pages to translate; ignored for Markdown and plain-text input files',
				routing: {
					send: {
						type: 'body',
						property: 'pages',
					},
				},
			},
			createResponseTypeField('translate'),
		],
	},
];
