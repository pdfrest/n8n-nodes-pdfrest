#!/usr/bin/env python3
"""Sanitize n8n workflow exports for strict workflow update requests."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import stat
import tempfile
from typing import Any


ALLOWED_TOP_LEVEL_KEYS = (
    "name",
    "nodes",
    "connections",
    "settings",
    "staticData",
    "nodeGroups",
    "pinData",
)
UNSUPPORTED_SETTINGS = ("binaryMode", "availableInMCP")


def sanitize(workflow: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    missing = [key for key in ALLOWED_TOP_LEVEL_KEYS if key not in workflow]
    if missing:
        raise ValueError(f"missing editable workflow fields: {', '.join(missing)}")

    removed = [key for key in workflow if key not in ALLOWED_TOP_LEVEL_KEYS]
    sanitized = {key: workflow[key] for key in ALLOWED_TOP_LEVEL_KEYS}

    settings = sanitized["settings"]
    if not isinstance(settings, dict):
        raise ValueError("settings must be a JSON object")

    sanitized_settings = dict(settings)
    for key in UNSUPPORTED_SETTINGS:
        if key in sanitized_settings:
            removed.append(f"settings.{key}")
            del sanitized_settings[key]
    sanitized["settings"] = sanitized_settings

    return sanitized, removed


def render(workflow: dict[str, Any]) -> str:
    return json.dumps(workflow, ensure_ascii=False, indent=2) + "\n"


def process(path: Path, check: bool) -> bool:
    try:
        current = path.read_text(encoding="utf-8")
        workflow = json.loads(current)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read valid JSON: {error}") from error

    if not isinstance(workflow, dict):
        raise ValueError("workflow export must be a JSON object")

    sanitized, removed = sanitize(workflow)
    output = render(sanitized)
    changed = current != output

    if check:
        state = "needs sanitizing" if changed else "is sanitized"
        print(f"{path}: {state}")
    elif changed:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, delete=False
        ) as temporary:
            temporary.write(output)
            temporary_path = Path(temporary.name)
        os.chmod(temporary_path, stat.S_IMODE(path.stat().st_mode))
        os.replace(temporary_path, path)
        print(f"{path}: sanitized")
    else:
        print(f"{path}: already sanitized")

    if removed:
        print(f"  removed: {', '.join(removed)}")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="report changes without editing files"
    )
    parser.add_argument(
        "files", nargs="+", type=Path, help="n8n workflow export JSON files"
    )
    args = parser.parse_args()

    needs_changes = False
    for path in args.files:
        try:
            needs_changes = process(path, args.check) or needs_changes
        except ValueError as error:
            parser.error(f"{path}: {error}")

    return 1 if args.check and needs_changes else 0


if __name__ == "__main__":
    raise SystemExit(main())
