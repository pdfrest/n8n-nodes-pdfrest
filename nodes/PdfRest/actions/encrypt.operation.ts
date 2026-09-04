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

function createPasswordValidator(
	bodyProperty: string,
	displayName: string,
	limits?: { minLength: number; maxLength: number },
): PreSendAction {
	return async function validatePassword(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const value =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject)[bodyProperty]
				: undefined;

		if (value === undefined && !limits) {
			return requestOptions;
		}

		if (
			typeof value !== 'string' ||
			(limits && (value.length < limits.minLength || value.length > limits.maxLength))
		) {
			const requirement = limits
				? ` must contain between ${limits.minLength} and ${limits.maxLength} characters.`
				: ' must be a string.';
			throw new NodeOperationError(this.getNode(), `${displayName}${requirement}`);
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
				preSend: [createPasswordValidator(bodyProperty, displayName)],
			},
		},
	};
}

export const encryptOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Encrypt PDF with Open Password',
	value: 'encrypt',
	action: 'Secure · Encrypt PDF (Add Password)',
	description: 'Protect a PDF with 256-bit AES encryption and a password required to open it',
	path: '/encrypted-pdf',
});

export const encryptDescription: INodeProperties[] = [
	createResourceIdField('encrypt'),
	{
		displayName: 'New Open Password',
		name: 'newOpenPassword',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['encrypt'],
			},
		},
		description: 'The password required to open the encrypted PDF',
		routing: {
			send: {
				type: 'body',
				property: 'new_open_password',
				preSend: [
					createPasswordValidator('new_open_password', 'New Open Password', {
						minLength: 6,
						maxLength: 128,
					}),
				],
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
				operation: ['encrypt'],
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
			createIncludeFileInfoField('encrypt'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated encrypted PDF without an extension',
			}),
			createResponseTypeField('encrypt'),
		],
	},
];
