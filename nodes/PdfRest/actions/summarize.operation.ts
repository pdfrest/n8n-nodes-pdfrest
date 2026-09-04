import type {
	IDataObject,
	IHttpRequestOptions,
	INodeProperties,
	INodePropertyOptions,
	PreSendAction,
} from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

function createOutputFileNamePreSend(): PreSendAction {
	return async function omitInactiveOutputFileName(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const outputType = this.getNodeParameter('options.outputType', 'json');
		if (outputType === 'file') {
			return requestOptions;
		}

		if (
			requestOptions.body &&
			typeof requestOptions.body === 'object' &&
			!Array.isArray(requestOptions.body)
		) {
			const body = { ...(requestOptions.body as IDataObject) };
			delete body.output;
			requestOptions.body = body;
		}

		return requestOptions;
	};
}

export const summarizeOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Summarize PDF, Markdown, or Plain Text',
	value: 'summarize',
	action: 'Analyze · Summarize PDF (AI)',
	description: 'Generate a structured AI summary from PDF, Markdown, or plain-text content',
	path: '/summarized-pdf-text',
});

export const summarizeDescription: INodeProperties[] = [
	createResourceIdField('summarize'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['summarize'],
			},
		},
		options: [
			createIncludeFileInfoField('summarize'),
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
				description: 'The name of the generated output file without an extension',
				routing: {
					send: {
						type: 'body',
						property: 'output',
						preSend: [createOutputFileNamePreSend()],
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
				description: 'Choose whether the summary uses Markdown syntax',
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
				description: 'Choose whether to return the summary as a file or in the JSON response',
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
				description: 'The pages to summarize, using page numbers, ranges, and last',
				routing: {
					send: {
						type: 'body',
						property: 'pages',
					},
				},
			},
			createResponseTypeField('summarize'),
			{
				displayName: 'Summary Format',
				name: 'summaryFormat',
				type: 'options',
				options: [
					{ name: 'Abstract', value: 'abstract' },
					{ name: 'Action Items', value: 'action_items' },
					{ name: 'Bullet Points', value: 'bullet_points' },
					{ name: 'Highlight', value: 'highlight' },
					{ name: 'Numbered List', value: 'numbered_list' },
					{ name: 'Outline', value: 'outline' },
					{ name: 'Overview', value: 'overview' },
					{ name: 'Question and Answer', value: 'question_answer' },
					{ name: 'Table of Contents', value: 'table_of_contents' },
				],
				default: 'overview',
				description: 'The structure to use for the generated summary',
				routing: {
					send: {
						type: 'body',
						property: 'summary_format',
					},
				},
			},
			{
				displayName: 'Target Word Count',
				name: 'targetWordCount',
				type: 'number',
				typeOptions: {
					minValue: 1,
					numberPrecision: 0,
				},
				default: 400,
				description: 'The target number of words in the summary',
				routing: {
					send: {
						type: 'body',
						property: 'target_word_count',
					},
				},
			},
		],
	},
];
