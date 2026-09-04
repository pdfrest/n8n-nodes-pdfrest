import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const unrestrictOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Remove PDF Permissions Restrictions',
	value: 'unrestrict',
	action: 'Secure · Remove PDF Restrictions',
	description: 'Remove document security restrictions from a PDF using its permissions password',
	path: '/unrestricted-pdf',
});

export const unrestrictDescription: INodeProperties[] = [
	createResourceIdField('unrestrict'),
	{
		displayName: 'Current Permissions Password',
		name: 'currentPermissionsPassword',
		type: 'string',
		typeOptions: {
			password: true,
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['unrestrict'],
			},
		},
		description: 'The existing permissions password required to remove restrictions',
		routing: {
			send: {
				type: 'body',
				property: 'current_permissions_password',
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
				operation: ['unrestrict'],
			},
		},
		options: [
			{
				displayName: 'Current Open Password',
				name: 'currentOpenPassword',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The existing open password used to preserve open-password encryption',
				routing: {
					send: {
						type: 'body',
						property: 'current_open_password',
					},
				},
			},
			createIncludeFileInfoField('unrestrict'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated unrestricted PDF without an extension',
			}),
			createResponseTypeField('unrestrict'),
		],
	},
];
