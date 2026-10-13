#!/usr/bin/env python3
"""Check built browser assets for direct project-brand and source-map leakage.

This is a narrow publication-output hygiene check. It does not inspect HTTP
behavior, perform a security scan, or claim that an application cannot be
fingerprinted from its implementation.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Sequence


BROWSER_ASSET_SUFFIXES = {".css", ".html", ".js"}
LEGAL_NOTICE_NAME = re.compile(
    r"^(?:(?:.*\.)?(?:license|licence|notice)|copying|notices|"
    r"third[-_]party[-_]notices|licenses)(?:\.(?:txt|md|json))?$",
    re.IGNORECASE,
)
FORBIDDEN_MARKERS = (
    (
        "FORBIDDEN_SKILL_IDENTIFIER",
        "ui-builder-xtn",
        re.compile(r"ui-builder-xtn", re.IGNORECASE),
    ),
    (
        "FORBIDDEN_REPOSITORY_OWNER",
        "xtnkking",
        re.compile(r"xtnkking", re.IGNORECASE),
    ),
    (
        "FORBIDDEN_PROMOTIONAL_NAME",
        "Personal UI",
        re.compile(r"\bpersonal\s+ui\b", re.IGNORECASE),
    ),
    (
        "FORBIDDEN_RUNTIME_BRAND",
        "personal-ui-focus-trap",
        re.compile(r"personal-ui-focus-trap", re.IGNORECASE),
    ),
    (
        "FORBIDDEN_LEGACY_NAMESPACE",
        "legacy component namespace",
        re.compile(r"personal[-_]ui|PersonalUI|PersonalUi|(?:data-|--_?|\b)pui[-_.]"),
    ),
)
SOURCE_MAPPING_URL = re.compile(
    r"(?://|/\*)\s*[@#]\s*sourceMappingURL\s*=",
    re.IGNORECASE,
)


def _issue(code: str, message: str, path: str | None = None) -> dict[str, str]:
    issue = {"code": code, "message": message}
    if path is not None:
        issue["path"] = path
    return issue


def _marker_issues(value: str, *, path: str, location: str) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    for code, label, pattern in FORBIDDEN_MARKERS:
        if pattern.search(value):
            issues.append(
                _issue(
                    code,
                    f"{location} contains the forbidden direct marker {label!r}",
                    path,
                )
            )
    return issues


def check_consumer_output(output: Path | None) -> dict[str, object]:
    """Return a deterministic JSON-compatible report for one output directory."""

    issues: list[dict[str, str]] = []
    checked_files = 0

    if output is None:
        issues.append(_issue("OUTPUT_REQUIRED", "--output is required"))
        return {"issues": issues, "checkedFiles": checked_files, "valid": False}

    output = output.expanduser()
    if not output.exists():
        issues.append(
            _issue(
                "OUTPUT_NOT_FOUND",
                f"browser publication output does not exist: {output}",
            )
        )
        return {"issues": issues, "checkedFiles": checked_files, "valid": False}
    if not output.is_dir():
        issues.append(
            _issue(
                "OUTPUT_NOT_DIRECTORY",
                f"browser publication output is not a directory: {output}",
            )
        )
        return {"issues": issues, "checkedFiles": checked_files, "valid": False}

    try:
        files = sorted(
            (path for path in output.rglob("*") if path.is_file()),
            key=lambda path: path.relative_to(output).as_posix().casefold(),
        )
    except OSError as error:
        issues.append(
            _issue(
                "OUTPUT_READ_FAILED",
                f"cannot enumerate browser publication output: {error}",
            )
        )
        return {"issues": issues, "checkedFiles": checked_files, "valid": False}

    browser_asset_count = 0
    for path in files:
        relative = path.relative_to(output).as_posix()
        checked_files += 1
        if path.suffix.lower() in BROWSER_ASSET_SUFFIXES:
            browser_asset_count += 1

        issues.extend(_marker_issues(relative, path=relative, location="file name"))
        if path.suffix.lower() == ".map":
            issues.append(
                _issue(
                    "SOURCE_MAP_FILE",
                    "source-map files are not allowed in browser publication output",
                    relative,
                )
            )

        try:
            content = path.read_bytes()
        except OSError as error:
            issues.append(
                _issue(
                    "FILE_READ_FAILED",
                    f"cannot read browser publication file: {error}",
                    relative,
                )
            )
            continue

        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            continue

        if not LEGAL_NOTICE_NAME.fullmatch(path.name):
            issues.extend(_marker_issues(text, path=relative, location="UTF-8 text"))
        if SOURCE_MAPPING_URL.search(text):
            issues.append(
                _issue(
                    "SOURCE_MAPPING_URL",
                    "sourceMappingURL comments are not allowed in browser publication output",
                    relative,
                )
            )

    if browser_asset_count == 0:
        issues.append(
            _issue(
                "NO_BROWSER_ASSETS",
                "output contains no browser .html, .js, or .css assets",
            )
        )

    return {
        "issues": issues,
        "checkedFiles": checked_files,
        "valid": not issues,
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        help="Built browser publication directory to inspect.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    report = check_consumer_output(args.output)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
