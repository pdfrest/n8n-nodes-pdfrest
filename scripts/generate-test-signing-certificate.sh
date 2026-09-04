#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 <output-directory>" >&2
	exit 2
fi

output_directory=$1
certificate_path="$output_directory/signing-certificate.pem"
private_key_path="$output_directory/signing-private-key.pem"
pfx_path="$output_directory/02-credential.pfx"
password_path="$output_directory/03-password.txt"

mkdir -p "$output_directory"
umask 077

for generated_path in "$certificate_path" "$private_key_path" "$pfx_path" "$password_path"; do
	if [[ -e "$generated_path" ]]; then
		echo "Refusing to overwrite $generated_path" >&2
		exit 1
	fi
done

cleanup() {
	rm -f -- "$certificate_path" "$private_key_path"
}
trap cleanup EXIT

password=$(openssl rand -hex 24)
printf '%s' "$password" > "$password_path"
openssl req \
	-x509 \
	-newkey rsa:2048 \
	-sha256 \
	-nodes \
	-days 1 \
	-subj "/CN=pdfRest CI Test/O=pdfRest Test" \
	-keyout "$private_key_path" \
	-out "$certificate_path" \
	>/dev/null 2>&1
openssl pkcs12 \
	-export \
	-name "pdfRest CI Test" \
	-inkey "$private_key_path" \
	-in "$certificate_path" \
	-out "$pfx_path" \
	-passout "file:$password_path" \
	>/dev/null 2>&1

printf '%s\n' "$pfx_path" "$password_path"
