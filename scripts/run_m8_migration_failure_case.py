#!/usr/bin/env python3
"""Exercise one candidate-installer rollback point for the M8 migration run."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

import install_personal_ui as installer


EXPECTED_FAILURE_EXIT_CODE = 8


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument(
        "--failure-point",
        choices=("copy", "dependencies", "package", "verify", "commit"),
        required=True,
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        context = installer.resolve_integrated_context(
            target=args.target,
            project_root=None,
            package_root=None,
            source_root=None,
            package_manager="auto",
            framework="auto",
        )
        registry = installer.load_registry()
        installer.install_integrated(
            context,
            registry=registry,
            force=False,
            dry_run=False,
            failure_point=args.failure_point,
        )
    except RuntimeError as error:
        expected = f"injected installer failure at {args.failure_point}"
        if expected not in str(error):
            print(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "kind": "personal-ui-m8-migration-rollback",
                        "result": "unexpected-failure",
                        "failurePoint": args.failure_point,
                        "error": str(error),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 2
        print(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "kind": "personal-ui-m8-migration-rollback",
                    "result": "expected-failure",
                    "failurePoint": args.failure_point,
                    "error": str(error),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return EXPECTED_FAILURE_EXIT_CODE
    except (OSError, ValueError, installer.InstallationConflict) as error:
        print(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "kind": "personal-ui-m8-migration-rollback",
                    "result": "setup-failure",
                    "failurePoint": args.failure_point,
                    "error": str(error),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2
    print(
        json.dumps(
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-migration-rollback",
                "result": "failure-not-injected",
                "failurePoint": args.failure_point,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
