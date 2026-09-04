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

type FormType = 'acroform' | 'xfa';

const formatsByFormType: Record<FormType, string[]> = {
	acroform: ['fdf', 'xfdf', 'xml'],
	xfa: ['xdp', 'xfd', 'xml'],
};

function createFormTypePreSend(): PreSendAction {
	return async function validateFormatForFormType(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const formType = this.getNodeParameter('formType', 'acroform') as FormType;
		if (!Object.prototype.hasOwnProperty.call(formatsByFormType, formType)) {
			throw new NodeOperationError(this.getNode(), 'Form Type has an invalid value.');
		}

		const body =
			requestOptions.body &&
			typeof requestOptions.body === 'object' &&
			!Array.isArray(requestOptions.body)
				? (requestOptions.body as IDataObject)
				: {};
		if (!formatsByFormType[formType].includes(body.data_format as string)) {
			throw new NodeOperationError(
				this.getNode(),
				`Data Format must be compatible with the selected ${formType === 'acroform' ? 'AcroForm' : 'XFA'} form type.`,
			);
		}

		return requestOptions;
	};
}

function createDataFormatField(
	formType: FormType,
	options: Array<{ name: string; value: string }>,
): INodeProperties {
	return {
		displayName: 'Data Format',
		name: 'dataFormat',
		type: 'options',
		options,
		default: 'xml',
		required: true,
		displayOptions: {
			show: {
				operation: ['exportFormData'],
				formType: [formType],
			},
		},
		description: 'The external data format for the exported form values',
		routing: { send: { type: 'body', property: 'data_format' } },
	};
}

export const exportFormDataOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Export PDF Form Data',
	value: 'exportFormData',
	action: 'Forms · Export Form Data',
	description: 'Export AcroForm or XFA field data from a PDF to a supported external data format',
	path: '/exported-form-data',
});

export const exportFormDataDescription: INodeProperties[] = [
	createResourceIdField('exportFormData'),
	{
		displayName: 'Form Type',
		name: 'formType',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'AcroForm', value: 'acroform' },
			{ name: 'XFA', value: 'xfa' },
		],
		default: 'acroform',
		required: true,
		displayOptions: { show: { operation: ['exportFormData'] } },
		description: 'The form technology used by the input PDF',
		routing: { send: { preSend: [createFormTypePreSend()] } },
	},
	createDataFormatField('acroform', [
		{ name: 'FDF', value: 'fdf' },
		{ name: 'XFDF', value: 'xfdf' },
		{ name: 'XML', value: 'xml' },
	]),
	createDataFormatField('xfa', [
		{ name: 'XDP', value: 'xdp' },
		{ name: 'XFD', value: 'xfd' },
		{ name: 'XML', value: 'xml' },
	]),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['exportFormData'] } },
		options: [
			createIncludeFileInfoField('exportFormData'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated form-data file without an extension',
			}),
			createResponseTypeField('exportFormData'),
		],
	},
];
