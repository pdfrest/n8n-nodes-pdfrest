import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type INodeProperties,
	type INodePropertyOptions,
	type PreSendAction,
} from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

function createOutputFileNamePreSend(): PreSendAction {
	return async function validateOutputFileName(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const output =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject).output
				: undefined;

		if (output !== undefined && (typeof output !== 'string' || output.length < 1)) {
			throw new NodeOperationError(
				this.getNode(),
				'Output File Name must contain at least one character.',
			);
		}

		return requestOptions;
	};
}

export const ocrOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'OCR PDF to Add Searchable Text',
	value: 'ocr',
	action: 'Extract · OCR PDF (Make Searchable)',
	description: 'Recognize text in PDF images and add searchable, extractable text behind them',
	path: '/pdf-with-ocr-text',
});

export const ocrDescription: INodeProperties[] = [
	createResourceIdField('ocr'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['ocr'],
			},
		},
		options: [
			createIncludeFileInfoField('ocr'),
			{
				displayName: 'Languages',
				name: 'languages',
				type: 'multiOptions',
				options: [
					{ name: 'Chinese Simplified', value: 'ChineseSimplified' },
					{ name: 'Chinese Traditional', value: 'ChineseTraditional' },
					{ name: 'Dutch', value: 'Dutch' },
					{ name: 'English', value: 'English' },
					{ name: 'French', value: 'French' },
					{ name: 'German', value: 'German' },
					{ name: 'Italian', value: 'Italian' },
					{ name: 'Japanese', value: 'Japanese' },
					{ name: 'Korean', value: 'Korean' },
					{ name: 'Portuguese', value: 'Portuguese' },
					{ name: 'Spanish', value: 'Spanish' },
				],
				default: ['English'],
				description:
					'The languages to recognize; selecting many languages may reduce performance',
				routing: {
					send: {
						type: 'body',
						property: 'languages',
						value: "={{ $value.join(',') }}",
					},
				},
			},
			{
				displayName: 'Output File Name',
				name: 'output',
				type: 'string',
				default: '',
				description: 'The name of the generated output file without an extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
						preSend: [createOutputFileNamePreSend()],
					},
				},
			},
			createResponseTypeField('ocr'),
		],
	},
];
