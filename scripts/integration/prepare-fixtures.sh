#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 <output-directory>" >&2
	exit 2
fi

script_directory=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
repository_root=$(cd "$script_directory/../.." && pwd -P)
output_directory=$1

if [[ "$output_directory" == "/" || -e "$output_directory" ]]; then
	echo "Output directory must not already exist: $output_directory" >&2
	exit 1
fi

umask 077
mkdir -p "$output_directory"
cp -R "$repository_root/test/fixtures/." "$output_directory/"
"$repository_root/scripts/generate-test-signing-certificate.sh" \
	"$output_directory/signed-pdf" \
	>/dev/null

expected_signing_files=$(printf '%s\n' \
	'01-document.pdf' \
	'02-credential.pfx' \
	'03-password.txt' \
	'04-logo.png')
actual_signing_files=$(find "$output_directory/signed-pdf" -maxdepth 1 -type f -exec basename {} \; | sort)
if [[ "$actual_signing_files" != "$expected_signing_files" ]]; then
	echo "Signing fixture files do not match the required lexical order" >&2
	exit 1
fi

printf '%s\n' "$output_directory"
