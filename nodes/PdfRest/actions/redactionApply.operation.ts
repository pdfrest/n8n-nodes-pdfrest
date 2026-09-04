import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createHexColorToRgbPreSend } from '../helpers/color';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const redactionApplyOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Apply Finalized Text Redactions to PDF',
	value: 'redactionApply',
	action: 'Secure · Redact PDF Text (Apply)',
	description: 'Permanently remove sensitive text identified in a reviewed redaction preview PDF',
	path: '/pdf-with-redacted-text-applied',
});

export const redactionApplyDescription: INodeProperties[] = [
	createResourceIdField('redactionApply'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['redactionApply'],
			},
		},
		options: [
			createIncludeFileInfoField('redactionApply'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated redacted PDF without an extension',
			}),
			{
				displayName: 'Redaction Color',
				name: 'redactionColor',
				type: 'color',
				default: '#000000',
				description: 'The redaction fill color',
				routing: {
					send: {
						type: 'body',
						property: 'rgb_color',
						preSend: [createHexColorToRgbPreSend('rgb_color', 'Redaction Color')],
					},
				},
			},
			createResponseTypeField('redactionApply'),
		],
	},
];
