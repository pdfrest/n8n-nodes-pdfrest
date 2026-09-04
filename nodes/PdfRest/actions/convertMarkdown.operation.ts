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
	return async function handleOutputFileName(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const outputType = this.getNodeParameter('options.outputType', 'json');
		const body = requestOptions.body;

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return requestOptions;
		}

		if (outputType !== 'file') {
			const nextBody = { ...(body as IDataObject) };
			delete nextBody.output;
			requestOptions.body = nextBody;
			return requestOptions;
		}

		const output = (body as IDataObject).output;
		if (output !== undefined && (typeof output !== 'string' || output.length < 1)) {
			throw new NodeOperationError(
				this.getNode(),
				'Output File Name must contain at least one character.',
			);
		}

		return requestOptions;
	};
}

export const convertMarkdownOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Convert PDF to Markdown',
	value: 'convertMarkdown',
	action: 'Convert · PDF to Markdown',
	description: 'Convert a PDF into clean, structured Markdown for reuse and text processing',
	path: '/markdown',
});

export const convertMarkdownDescription: INodeProperties[] = [
	createResourceIdField('convertMarkdown'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['convertMarkdown'],
			},
		},
		options: [
			createIncludeFileInfoField('convertMarkdown'),
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
				description: 'The name of the generated Markdown file without an extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
						preSend: [createOutputFileNamePreSend()],
					},
				},
			},
			{
				displayName: 'Output Type',
				name: 'outputType',
				type: 'options',
				options: [
					{ name: 'JSON', value: 'json' },
					{ name: 'Markdown File', value: 'file' },
				],
				default: 'json',
				description: 'Choose whether to return Markdown in JSON or as a downloadable file',
				routing: {
					send: {
						type: 'body',
						property: 'output_type',
					},
				},
			},
			{
				displayName: 'Page Break Comments',
				name: 'pageBreakComments',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				description: 'Choose whether to insert page breaks as HTML comments',
				routing: {
					send: {
						type: 'body',
						property: 'page_break_comments',
					},
				},
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'string',
				default: '1-last',
				placeholder: 'e.g. 1,2,5-10,12-last',
				description: 'The pages to convert, using page numbers, ranges, and last',
				routing: {
					send: {
						type: 'body',
						property: 'pages',
					},
				},
			},
			createResponseTypeField('convertMarkdown'),
		],
	},
];
