#!/usr/bin/env python3
"""Generate the lockfile-bound third-party dependency inventory."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import release_personal_ui as release


SKILL_ROOT = Path(__file__).resolve().parent.parent
LOCK_PATH = SKILL_ROOT / release.VERSION_PATHS["lock"]
NOTICE_PATH = SKILL_ROOT / release.STRUCTURED_NOTICE_FILE


def notice_bytes() -> bytes:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    inventory = release._locked_notice_inventory(lock)
    if not inventory:
        raise SystemExit("package-lock dependency inventory is empty or invalid")

    items: list[dict[str, object]] = []
    for name, version in sorted(inventory):
        metadata = inventory[(name, version)]
        resolved = str(metadata["resolved"])
        items.append(
            {
                "name": name,
                "version": version,
                "license": metadata["license"],
                "source": resolved,
                "resolved": resolved,
                "dependencyType": metadata["dependencyType"],
                "optional": metadata["optional"],
            }
        )

    notice = {
        "schemaVersion": release.SCHEMA_VERSION,
        "kind": "personal-ui-third-party-notices",
        "generatedFrom": release.VERSION_PATHS["lock"],
        "dependencyCount": len(items),
        "items": items,
    }
    return (json.dumps(notice, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = notice_bytes()

    if args.check:
        if not NOTICE_PATH.is_file() or NOTICE_PATH.read_bytes() != expected:
            print("THIRD_PARTY_NOTICES.json is stale; run with --write")
            return 1
        print("Third-party notices are current")
        return 0

    NOTICE_PATH.write_bytes(expected)
    print(f"Wrote {NOTICE_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
