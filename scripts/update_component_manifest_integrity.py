#!/usr/bin/env python3
"""Refresh managed Personal UI SHA-256 hashes in the component manifest."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parent.parent
KIT_ROOT = SKILL_ROOT / "assets" / "react-kit"
SOURCE_ROOT = KIT_ROOT / "src" / "personal-ui"
MANIFEST_PATH = KIT_ROOT / "component-manifest.json"


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("component manifest must contain an object")
    integrity = {
        path.relative_to(SOURCE_ROOT).as_posix(): hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        for path in sorted(SOURCE_ROOT.rglob("*"))
        if path.is_file()
    }
    manifest["sourceIntegrity"] = integrity
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"updated": str(MANIFEST_PATH), "files": len(integrity)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
