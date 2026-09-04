import type {
	IDataObject,
	IHttpRequestOptions,
	INodeProperties,
	INodePropertyOptions,
	PreSendAction,
} from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

interface DependentBodyFieldOptions {
	bodyProperty: string;
	controllingParameter: string;
	fallbackValue: string;
	inactiveValues: string[];
}

function createDependentBodyFieldPreSend({
	bodyProperty,
	controllingParameter,
	fallbackValue,
	inactiveValues,
}: DependentBodyFieldOptions): PreSendAction {
	return async function omitInactiveBodyField(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const controllingValue = String(
			this.getNodeParameter(controllingParameter, fallbackValue),
		);
		if (!inactiveValues.includes(controllingValue)) {
			return requestOptions;
		}

		if (
			requestOptions.body &&
			typeof requestOptions.body === 'object' &&
			!Array.isArray(requestOptions.body)
		) {
			const body = { ...(requestOptions.body as IDataObject) };
			delete body[bodyProperty];
			requestOptions.body = body;
		}

		return requestOptions;
	};
}

export const extractTextOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Extract Text from PDF',
	value: 'extractText',
	action: 'Extract · Text from PDF',
	description: 'Extract PDF text with optional style and position information',
	path: '/extracted-text',
});

export const extractTextDescription: INodeProperties[] = [
	createResourceIdField('extractText'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['extractText'],
			},
		},
		options: [
			{
				displayName: 'Full Text',
				name: 'fullText',
				type: 'options',
				options: [
					{ name: 'By Page', value: 'by_page' },
					{ name: 'Document', value: 'document' },
					{ name: 'Off', value: 'off' },
				],
				default: 'document',
				description: 'Choose whether to return combined, page-separated, or no full text',
				routing: {
					send: {
						type: 'body',
						property: 'full_text',
					},
				},
			},
			createIncludeFileInfoField('extractText'),
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
				description: 'The name of the generated JSON file without an extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
						preSend: [
							createDependentBodyFieldPreSend({
								bodyProperty: 'output',
								controllingParameter: 'options.outputType',
								fallbackValue: 'json',
								inactiveValues: ['json'],
							}),
						],
					},
				},
			},
			{
				displayName: 'Output Type',
				name: 'outputType',
				type: 'options',
				options: [
					{ name: 'File', value: 'file' },
					{ name: 'JSON', value: 'json' },
				],
				default: 'json',
				description: 'Choose whether to return extracted text as a file or in the JSON response',
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
				description: 'The pages to process, using page numbers, ranges, and last',
				routing: {
					send: {
						type: 'body',
						property: 'pages',
					},
				},
			},
			{
				displayName: 'Preserve Line Breaks',
				name: 'preserveLineBreaks',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				displayOptions: {
					hide: {
						fullText: ['off'],
					},
				},
				description: 'Choose whether to preserve original line breaks in full text',
				routing: {
					send: {
						type: 'body',
						property: 'preserve_line_breaks',
						preSend: [
							createDependentBodyFieldPreSend({
								bodyProperty: 'preserve_line_breaks',
								controllingParameter: 'options.fullText',
								fallbackValue: 'document',
								inactiveValues: ['off'],
							}),
						],
					},
				},
			},
			createResponseTypeField('extractText'),
			{
				displayName: 'Word Coordinates',
				name: 'wordCoordinates',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				description: 'Choose whether to include each word’s page and corner coordinates',
				routing: {
					send: {
						type: 'body',
						property: 'word_coordinates',
					},
				},
			},
			{
				displayName: 'Word Style',
				name: 'wordStyle',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				description: 'Choose whether to include font, size, color, and color-space details',
				routing: {
					send: {
						type: 'body',
						property: 'word_style',
					},
				},
			},
		],
	},
];
