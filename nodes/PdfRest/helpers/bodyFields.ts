import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type INodeProperties,
	type PreSendAction,
} from 'n8n-workflow';

interface NonEmptyBodyStringFieldOptions {
	displayName: string;
	name: string;
	bodyProperty: string;
	description: string;
	password?: boolean;
}

function createNonEmptyBodyStringPreSend(
	bodyProperty: string,
	displayName: string,
): PreSendAction {
	return async function validateNonEmptyBodyString(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const value =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject)[bodyProperty]
				: undefined;

		if (value !== undefined && (typeof value !== 'string' || value.length < 1)) {
			throw new NodeOperationError(
				this.getNode(),
				`${displayName} must contain at least one character.`,
			);
		}

		return requestOptions;
	};
}

export function createNonEmptyBodyStringField({
	displayName,
	name,
	bodyProperty,
	description,
	password = false,
}: NonEmptyBodyStringFieldOptions): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		...(password ? { typeOptions: { password: true } } : {}),
		default: '',
		description,
		routing: {
			send: {
				type: 'body',
				property: bodyProperty,
				preSend: [createNonEmptyBodyStringPreSend(bodyProperty, displayName)],
			},
		},
	};
}
