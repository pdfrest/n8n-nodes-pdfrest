import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const decryptOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Remove Encryption from PDF',
	value: 'decrypt',
	action: 'Secure · Decrypt PDF (Remove Password)',
	description: 'Remove PDF encryption using the current open password and permissions password if required',
	path: '/decrypted-pdf',
});

export const decryptDescription: INodeProperties[] = [
	createResourceIdField('decrypt'),
	{
		displayName: 'Current Open Password',
		name: 'currentOpenPassword',
		type: 'string',
		typeOptions: {
			password: true,
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['decrypt'],
			},
		},
		description: 'The existing password required to open the encrypted PDF',
		routing: {
			send: {
				type: 'body',
				property: 'current_open_password',
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
				operation: ['decrypt'],
			},
		},
		options: [
			{
				displayName: 'Current Permissions Password',
				name: 'currentPermissionsPassword',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The existing permissions password, when the PDF has one',
				routing: {
					send: {
						type: 'body',
						property: 'current_permissions_password',
					},
				},
			},
			createIncludeFileInfoField('decrypt'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated decrypted PDF without an extension',
			}),
			createResponseTypeField('decrypt'),
		],
	},
];
