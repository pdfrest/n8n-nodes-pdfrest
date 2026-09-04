import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type PreSendAction,
} from 'n8n-workflow';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function createHexColorToRgbPreSend(
	bodyProperty: string,
	displayName: string,
): PreSendAction {
	return async function convertHexColorToRgb(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const color =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject)[bodyProperty]
				: undefined;

		if (color === undefined) return requestOptions;

		if (typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)) {
			throw new NodeOperationError(
				this.getNode(),
				`${displayName} must be a six-digit hexadecimal color.`,
			);
		}

		const channels = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((channel) =>
			Number.parseInt(channel, 16),
		);
		(body as IDataObject)[bodyProperty] = channels.join(',');

		return requestOptions;
	};
}
