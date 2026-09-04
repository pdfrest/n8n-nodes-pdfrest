import type {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IHttpRequestOptions,
	INodeCredentialTestResult,
} from 'n8n-workflow';
import {
	CUSTOM_BASE_URL,
	getPdfRestBaseUrl,
	PdfRestBaseUrlError,
} from './helpers/baseUrl';

const credentialTestRequestId = '00000000-0000-0000-0000-000000000000';
const requestNotFoundMessage = 'requestID not found.';

type CredentialTestResponse = {
	statusCode: number;
	body?: unknown;
};

type CredentialTestHttpHelpers = {
	httpRequest(options: IHttpRequestOptions): Promise<CredentialTestResponse>;
};

function getResponseError(body: unknown): string | undefined {
	if (typeof body !== 'object' || body === null || !('error' in body)) {
		return undefined;
	}

	return typeof body.error === 'string' ? body.error : undefined;
}

export async function testPdfRestCredentials(
	this: ICredentialTestFunctions,
	credential: ICredentialsDecrypted,
): Promise<INodeCredentialTestResult> {
	try {
		const credentialData = credential.data ?? {};
		const baseUrl = getPdfRestBaseUrl(credentialData);
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (credentialData.baseUrl !== CUSTOM_BASE_URL) {
			headers['Api-Key'] = String(credentialData.apiKey ?? '');
		}

		const { httpRequest } = this.helpers as unknown as CredentialTestHttpHelpers;
		const response = await httpRequest({
			method: 'GET',
			url: `${baseUrl}/request-status/${credentialTestRequestId}`,
			headers,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		});
		const responseError = getResponseError(response.body);

		if (response.statusCode === 404 && responseError?.startsWith(requestNotFoundMessage)) {
			return {
				status: 'OK',
				message: 'Connection successful',
			};
		}

		if (response.statusCode === 401) {
			return {
				status: 'Error',
				message: 'The API key is invalid',
			};
		}

		return {
			status: 'Error',
			message: responseError ?? `Credential test failed with HTTP status ${response.statusCode}`,
		};
	} catch (error) {
		return {
			status: 'Error',
			message:
				error instanceof PdfRestBaseUrlError
					? error.message
					: 'Could not connect to the configured pdfRest API Base URL',
		};
	}
}
