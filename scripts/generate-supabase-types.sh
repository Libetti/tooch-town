#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_PATH="${SUPABASE_TYPES_OUTPUT:-$ROOT_DIR/src/lib/supabase/database.types.ts}"
SCHEMA_NAME="${SUPABASE_SCHEMA:-public}"
PROJECT_REF_FILE="$ROOT_DIR/supabase/.temp/project-ref"

mkdir -p "$(dirname "$OUTPUT_PATH")"

if [[ "${1:-}" == "--local" ]]; then
	supabase gen types typescript --local --schema "$SCHEMA_NAME" >"$OUTPUT_PATH"
elif [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
	supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema "$SCHEMA_NAME" >"$OUTPUT_PATH"
elif [[ -f "$PROJECT_REF_FILE" ]]; then
	PROJECT_REF="$(tr -d '[:space:]' <"$PROJECT_REF_FILE")"
	if [[ -z "$PROJECT_REF" ]]; then
		echo "Supabase project ref file is empty: $PROJECT_REF_FILE" >&2
		exit 1
	fi

	supabase gen types typescript --project-id "$PROJECT_REF" --schema "$SCHEMA_NAME" >"$OUTPUT_PATH"
else
	supabase gen types typescript --linked --schema "$SCHEMA_NAME" >"$OUTPUT_PATH"
fi

echo "Generated Supabase types at $OUTPUT_PATH"
