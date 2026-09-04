import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type INodeProperties,
	type INodePropertyOptions,
	type PreSendAction,
} from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

const redactionsExample = JSON.stringify(
	[
		{ type: 'preset', value: 'email' },
		{
			type: 'regex',
			value: '(\\+\\d{1,2}\\s)?\\(?\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4}',
		},
		{ type: 'literal', value: 'word' },
	],
	null,
	2,
);

const redactionPresets = [
	'email',
	'phone_number',
	'date',
	'us_ssn',
	'url',
	'credit_card',
	'credit_debit_pin',
	'bank_routing_number',
	'international_bank_account_number',
	'swift_bic_number',
	'ipv4',
	'ipv6',
] as const;

function isRedaction(value: unknown): boolean {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const entries = Object.entries(value);
	if (entries.length !== 2 || !('type' in value) || !('value' in value)) {
		return false;
	}

	const { type, value: redactionValue } = value as Record<string, unknown>;
	if (typeof redactionValue !== 'string') {
		return false;
	}

	if (type === 'literal' || type === 'regex') {
		return true;
	}

	return type === 'preset' && redactionPresets.includes(redactionValue as never);
}

function createRedactionsPreSend(): PreSendAction {
	return async function serializeRedactions(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const input =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject).redactions
				: undefined;

		let redactions: unknown = input;
		if (typeof input === 'string') {
			try {
				redactions = JSON.parse(input);
			} catch {
				throw new NodeOperationError(this.getNode(), 'Redactions must contain valid JSON.');
			}
		}

		if (!Array.isArray(redactions) || !redactions.every(isRedaction)) {
			throw new NodeOperationError(
				this.getNode(),
				'Redactions must be an array of valid literal, regex, or preset objects.',
			);
		}

		requestOptions.body = {
			...(body as IDataObject),
			redactions: JSON.stringify(redactions),
		};
		return requestOptions;
	};
}

export const redactionPreviewOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Generate Redaction Preview PDF',
	value: 'redactionPreview',
	action: 'Secure · Redact PDF Text (Preview)',
	description:
		'Create a PDF that highlights proposed text redactions for review before applying them',
	path: '/pdf-with-redacted-text-preview',
});

export const redactionPreviewDescription: INodeProperties[] = [
	createResourceIdField('redactionPreview'),
	{
		displayName: 'Redactions',
		name: 'redactions',
		type: 'json',
		default: redactionsExample,
		required: true,
		displayOptions: {
			show: {
				operation: ['redactionPreview'],
			},
		},
		description:
			'A JSON array describing the literal, regular expression, or preset matches to redact',
		routing: {
			send: {
				type: 'body',
				property: 'redactions',
				preSend: [createRedactionsPreSend()],
			},
		},
	},
	{
		displayName:
			'Redactions documentation: <a href="https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/redact-pdf/POST/pdf-with-redacted-text-preview.body.redactions/" target="_blank">Learn how to build the object</a>',
		name: 'redactionsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { operation: ['redactionPreview'] } },
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['redactionPreview'],
			},
		},
		options: [
			createIncludeFileInfoField('redactionPreview'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated redaction preview PDF without an extension',
			}),
			createResponseTypeField('redactionPreview'),
		],
	},
];
