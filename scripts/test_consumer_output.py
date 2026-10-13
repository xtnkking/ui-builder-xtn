#!/usr/bin/env python3
"""Focused contracts for browser publication output hygiene."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from check_consumer_output import check_consumer_output


class ConsumerOutputContracts(unittest.TestCase):
    def test_neutral_browser_output_passes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="consumer-output-") as temporary:
            output = Path(temporary)
            assets = output / "assets"
            assets.mkdir()
            (output / "index.html").write_text(
                "<!doctype html><title>Northstar Console</title><div id='root'></div>",
                encoding="utf-8",
            )
            (assets / "app.js").write_text(
                "const owner = 'data-ui-owner'; const component = 'ui-button';",
                encoding="utf-8",
            )
            (assets / "app.css").write_text(
                ".ui-button { color: var(--ui-primary); }",
                encoding="utf-8",
            )
            (output / "LICENSES.txt").write_text(
                "React: https://github.com/facebook/react\n"
                "Lucide: https://github.com/lucide-icons/lucide\n"
                "Personal UI: Copyright xtnkking; MIT license retained\n",
                encoding="utf-8",
            )
            (assets / "app.js.LICENSE.txt").write_text(
                "Copyright (c) 2026 xtnkking; MIT license\n", encoding="utf-8"
            )
            (output / "THIRD_PARTY_NOTICES.json").write_text(
                '{"Personal UI": "Copyright xtnkking; MIT license"}', encoding="utf-8"
            )

            report = check_consumer_output(output)

            self.assertTrue(report["valid"], report["issues"])
            self.assertEqual(report["checkedFiles"], 6)
            self.assertEqual(report["issues"], [])

    def test_brand_and_repository_markers_in_html_and_javascript_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="consumer-output-") as temporary:
            output = Path(temporary)
            assets = output / "assets"
            assets.mkdir()
            (output / "index.html").write_text(
                "<!doctype html><title>Personal UI</title>",
                encoding="utf-8",
            )
            (assets / "app.js").write_text(
                "const repository = 'https://github.com/xtnkking/ui-builder-xtn';"
                "const focus = Symbol('personal-ui-focus-trap');",
                encoding="utf-8",
            )

            report = check_consumer_output(output)
            codes = {issue["code"] for issue in report["issues"]}
            paths = {issue.get("path") for issue in report["issues"]}

            self.assertFalse(report["valid"])
            self.assertIn("FORBIDDEN_PROMOTIONAL_NAME", codes)
            self.assertIn("FORBIDDEN_REPOSITORY_OWNER", codes)
            self.assertIn("FORBIDDEN_SKILL_IDENTIFIER", codes)
            self.assertIn("FORBIDDEN_RUNTIME_BRAND", codes)
            self.assertEqual(paths, {"index.html", "assets/app.js"})

    def test_source_maps_and_inline_source_mapping_comments_are_rejected(self) -> None:
        fixtures = (
            ("map-file", "assets/app.js.map", "{}", "SOURCE_MAP_FILE"),
            (
                "inline-javascript",
                "assets/app.js",
                "console.log('ready');\n//# sourceMappingURL=data:application/json;base64,e30=",
                "SOURCE_MAPPING_URL",
            ),
            (
                "linked-css",
                "assets/app.css",
                "body { color: black; }\n/*# sourceMappingURL=app.css.map */",
                "SOURCE_MAPPING_URL",
            ),
        )
        for name, relative, content, expected_code in fixtures:
            with self.subTest(name=name), tempfile.TemporaryDirectory(
                prefix="consumer-output-"
            ) as temporary:
                output = Path(temporary)
                assets = output / "assets"
                assets.mkdir()
                (output / "index.html").write_text(
                    "<!doctype html><title>Northstar Console</title>",
                    encoding="utf-8",
                )
                path = output / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")

                report = check_consumer_output(output)
                codes = {issue["code"] for issue in report["issues"]}

                self.assertFalse(report["valid"])
                self.assertIn(expected_code, codes)

    def test_legacy_source_and_style_namespaces_are_rejected(self) -> None:
        for marker in ("src/personal-ui", "PersonalUILocale", "data-pui-owner", ".pui-button", "--_pui-overlay"):
            with self.subTest(marker=marker), tempfile.TemporaryDirectory(prefix="consumer-output-") as temporary:
                output = Path(temporary)
                (output / "app.js").write_text(f"const marker = '{marker}';", encoding="utf-8")
                report = check_consumer_output(output)
                self.assertFalse(report["valid"])
                self.assertIn("FORBIDDEN_LEGACY_NAMESPACE", {issue["code"] for issue in report["issues"]})


if __name__ == "__main__":
    unittest.main()
