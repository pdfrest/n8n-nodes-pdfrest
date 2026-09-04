import type { ICredentialDataDecryptedObject } from 'n8n-workflow';

export const CUSTOM_BASE_URL = 'custom';
export const PDFREST_BASE_URL_ERROR_MESSAGE =
	'The pdfRest API Base URL must be an HTTP or HTTPS URL without credentials, a query string, or a fragment';

export class PdfRestBaseUrlError extends Error {
	constructor() {
		super(PDFREST_BASE_URL_ERROR_MESSAGE);
		this.name = 'PdfRestBaseUrlError';
	}
}

function invalidBaseUrl(): never {
	// Credential authentication has no execution-node context for a NodeOperationError.
	throw new PdfRestBaseUrlError();
}

function getConfiguredBaseUrl(credentials: ICredentialDataDecryptedObject): string {
	const selectedBaseUrl = String(credentials.baseUrl ?? '').trim();
	return selectedBaseUrl === CUSTOM_BASE_URL
		? String(credentials.customBaseUrl ?? '').trim()
		: selectedBaseUrl;
}

export function normalizePdfRestBaseUrl(value: string): string {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return invalidBaseUrl();
	}

	if (
		(url.protocol !== 'http:' && url.protocol !== 'https:') ||
		url.username !== '' ||
		url.password !== '' ||
		url.search !== '' ||
		url.hash !== ''
	) {
		return invalidBaseUrl();
	}

	url.pathname = url.pathname.replace(/\/+$/, '');
	return url.toString().replace(/\/$/, '');
}

export function getPdfRestBaseUrl(credentials: ICredentialDataDecryptedObject): string {
	return normalizePdfRestBaseUrl(getConfiguredBaseUrl(credentials));
}

export function normalizePdfRestRequestUrl(
	requestUrl: string,
	credentials: ICredentialDataDecryptedObject,
): string {
	const configuredBaseUrl = getConfiguredBaseUrl(credentials);
	const normalizedBaseUrl = normalizePdfRestBaseUrl(configuredBaseUrl);
	const comparableBaseUrl = configuredBaseUrl.replace(/\/+$/, '');

	if (requestUrl === configuredBaseUrl || requestUrl === comparableBaseUrl) {
		return normalizedBaseUrl;
	}

	if (requestUrl.startsWith(`${comparableBaseUrl}/`)) {
		return `${normalizedBaseUrl}/${requestUrl.slice(comparableBaseUrl.length).replace(/^\/+/, '')}`;
	}

	return requestUrl;
}
