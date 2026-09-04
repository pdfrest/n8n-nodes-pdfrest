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

function createPermissionsPasswordPreSend(): PreSendAction {
	return async function validatePermissionsPassword(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const value =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject).new_permissions_password
				: undefined;

		if (typeof value !== 'string' || value.length < 6 || value.length > 128) {
			throw new NodeOperationError(
				this.getNode(),
				'New Permissions Password must contain between 6 and 128 characters.',
			);
		}

		return requestOptions;
	};
}

function createCurrentPasswordField(
	displayName: string,
	name: string,
	bodyProperty: string,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		typeOptions: { password: true },
		default: '',
		description,
		routing: {
			send: {
				type: 'body',
				property: bodyProperty,
			},
		},
	};
}

export const restrictOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Apply PDF Permissions Restrictions',
	value: 'restrict',
	action: 'Secure · Restrict PDF Permissions',
	description: 'Protect PDF operations with a permissions password and selected document restrictions',
	path: '/restricted-pdf',
});

export const restrictDescription: INodeProperties[] = [
	createResourceIdField('restrict'),
	{
		displayName: 'New Permissions Password',
		name: 'newPermissionsPassword',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['restrict'],
			},
		},
		description: 'The password used to manage restrictions on the generated PDF',
		routing: {
			send: {
				type: 'body',
				property: 'new_permissions_password',
				preSend: [createPermissionsPasswordPreSend()],
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
				operation: ['restrict'],
			},
		},
		options: [
			createCurrentPasswordField(
				'Current Open Password',
				'currentOpenPassword',
				'current_open_password',
				'The existing password required to open the input PDF',
			),
			createCurrentPasswordField(
				'Current Permissions Password',
				'currentPermissionsPassword',
				'current_permissions_password',
				'The existing permissions password for the input PDF',
			),
			createIncludeFileInfoField('restrict'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated restricted PDF without an extension',
			}),
			createResponseTypeField('restrict'),
			{
				displayName: 'Restrictions',
				name: 'restrictions',
				type: 'multiOptions',
				options: [
					{ name: 'Annotations', value: 'edit_annotations' },
					{ name: 'Content Copying', value: 'copy_content' },
					{ name: 'Content Editing', value: 'edit_content' },
					{ name: 'Disable Accessibility', value: 'accessibility_off' },
					{ name: 'Document Assembly', value: 'edit_document_assembly' },
					{ name: 'Fill and Sign Form Fields', value: 'edit_fill_and_sign_form_fields' },
					{ name: 'High-Quality Printing', value: 'print_high' },
					{ name: 'Low-Quality Printing', value: 'print_low' },
				],
				default: [],
				description: 'The PDF operations to protect with the permissions password',
				routing: {
					send: {
						type: 'body',
						property: 'restrictions[]',
						propertyInDotNotation: false,
					},
				},
			},
		],
	},
];
