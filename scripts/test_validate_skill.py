#!/usr/bin/env python3
"""Contract tests for the repository-owned Skill validator."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from validate_skill import validate_skill


VALID_SKILL = """---
name: sample-skill
description: A focused sample Skill.
metadata:
  short-description: Sample
---

# Sample

Use the sample.
"""


class SkillValidationContractTests(unittest.TestCase):
    def validate_text(self, content: str) -> tuple[bool, str]:
        with tempfile.TemporaryDirectory(prefix="personal-ui-skill-validation-") as temporary:
            root = Path(temporary)
            (root / "SKILL.md").write_text(content, encoding="utf-8")
            return validate_skill(root)

    def validate_tree(self, files: dict[str, str]) -> tuple[bool, str]:
        with tempfile.TemporaryDirectory(prefix="personal-ui-skill-validation-") as temporary:
            root = Path(temporary)
            for relative_path, content in files.items():
                target = root / relative_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            return validate_skill(root)

    def ui_builder_fixture(self, skill_content: str) -> dict[str, str]:
        files = {"SKILL.md": skill_content}
        for route in (
            "references/component-api.md",
            "references/component-catalog.md",
            "references/data-workflows.md",
            "references/form-contract.md",
            "references/integration.md",
            "references/locale-contract.md",
            "references/overlay-contract.md",
            "references/page-patterns.md",
            "references/source-authority.md",
            "references/v0.3.0-migrations.md",
            "references/v0.3.0-roadmap.md",
        ):
            files[route] = "# Stub\n"
        return files

    def test_current_repository_skill_is_valid(self) -> None:
        valid, message = validate_skill(Path(__file__).resolve().parent.parent)
        self.assertTrue(valid, message)

    def test_valid_frontmatter_and_nested_metadata_pass(self) -> None:
        valid, message = self.validate_text(VALID_SKILL)
        self.assertTrue(valid, message)

    def test_unknown_frontmatter_key_fails(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL.replace("metadata:\n", "unsupported: true\nmetadata:\n")
        )
        self.assertFalse(valid)
        self.assertIn("unexpected frontmatter key", message)

    def test_invalid_skill_name_fails(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL.replace("name: sample-skill", "name: Sample_Skill")
        )
        self.assertFalse(valid)
        self.assertIn("lowercase hyphen-case", message)

    def test_unfinished_todo_outside_a_code_fence_fails(self) -> None:
        valid, message = self.validate_text(VALID_SKILL + "\n[TODO: finish this]\n")
        self.assertFalse(valid)
        self.assertIn("unfinished TODO", message)

    def test_todo_example_inside_a_code_fence_is_allowed(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n```text\n[TODO: example only]\n```\n"
        )
        self.assertTrue(valid, message)

    def test_indented_fence_lines_do_not_hide_real_todo(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n    ```\n[TODO: finish this]\n    ```\n"
        )
        self.assertFalse(valid)
        self.assertIn("unfinished TODO", message)

    def test_broken_relative_markdown_link_fails(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n[Missing reference](references/missing.md)\n"
        )
        self.assertFalse(valid)
        self.assertIn("broken Markdown link", message)

    def test_broken_markdown_anchor_fails(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": VALID_SKILL + "\n[Wrong section](references/guide.md#missing)\n",
                "references/guide.md": "# Existing section\n",
            }
        )
        self.assertFalse(valid)
        self.assertIn("broken Markdown anchor", message)

    def test_unicode_markdown_anchor_passes(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": VALID_SKILL + "\n[阶段](references/guide.md#阶段-一)\n",
                "references/guide.md": "# 阶段 一\n",
            }
        )
        self.assertTrue(valid, message)

    def test_links_inside_fenced_code_are_not_document_routes(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n```markdown\n[Example](missing.md)\n```\n"
        )
        self.assertTrue(valid, message)

    def test_links_inside_inline_and_indented_code_are_ignored(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL
            + "\n`[Inline example](missing-inline.md)`\n\n"
            + "    [Indented example](missing-indented.md)\n"
        )
        self.assertTrue(valid, message)

    def test_links_inside_multiline_code_span_are_ignored(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n``code starts\n[Example](missing.md)\ncode ends``\n"
        )
        self.assertTrue(valid, message)

    def test_commonmark_fence_boundaries_do_not_hide_or_invent_links(self) -> None:
        hidden_real_link = (
            VALID_SKILL
            + "\n    ```\n[Missing](missing.md)\n    ```\n"
        )
        valid, message = self.validate_text(hidden_real_link)
        self.assertFalse(valid)
        self.assertIn("broken Markdown link", message)

        quoted_code = (
            VALID_SKILL
            + "\n> ```markdown\n> [Example](missing.md)\n> ```\n"
        )
        valid, message = self.validate_text(quoted_code)
        self.assertTrue(valid, message)

        non_closing_fence = (
            VALID_SKILL
            + "\n```text\n```not-a-close\n[Example](missing.md)\n```\n"
        )
        valid, message = self.validate_text(non_closing_fence)
        self.assertTrue(valid, message)

        invalid_backtick_info = (
            VALID_SKILL
            + "\n```bad`info\n[Missing](missing.md)\n```\n"
        )
        valid, message = self.validate_text(invalid_backtick_info)
        self.assertFalse(valid)
        self.assertIn("broken Markdown link", message)

    def test_balanced_parentheses_in_link_destination_pass(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": VALID_SKILL + "\n[Guide](references/a(b).md)\n",
                "references/a(b).md": "# Guide\n",
            }
        )
        self.assertTrue(valid, message)

    def test_parenthesized_title_and_nested_label_are_validated(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n[see [details]](references/missing.md (title))\n"
        )
        self.assertFalse(valid)
        self.assertIn("broken Markdown link", message)

    def test_escaped_link_literal_is_ignored(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n\\[Example](references/missing.md)\n"
        )
        self.assertTrue(valid, message)

    def test_broken_reference_style_link_fails(self) -> None:
        valid, message = self.validate_text(
            VALID_SKILL + "\n[Guide][guide]\n\n[guide]: references/missing.md\n"
        )
        self.assertFalse(valid)
        self.assertIn("broken Markdown link", message)

    def test_undefined_reference_style_link_fails(self) -> None:
        valid, message = self.validate_text(VALID_SKILL + "\n[Guide][missing]\n")
        self.assertFalse(valid)
        self.assertIn("undefined Markdown reference", message)

    def test_github_anchor_collision_and_link_label_are_supported(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": VALID_SKILL + "\n[Third](references/guide.md#foo-2)\n[Linked](references/guide.md#linked_heading)\n",
                "references/guide.md": "# Foo\n# Foo-1\n# Foo\n# [Linked_heading](elsewhere.md)\n",
                "references/elsewhere.md": "# Elsewhere\n",
            }
        )
        self.assertTrue(valid, message)

    def test_inline_code_and_emphasis_render_to_github_anchors(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": (
                    VALID_SKILL
                    + "\n[Code](references/guide.md#use-foo_bar-api)\n"
                    + "[Emphasis](references/guide.md#hello-world)\n"
                ),
                "references/guide.md": "## Use `foo_bar` API\n## _Hello_ world\n",
            }
        )
        self.assertTrue(valid, message)

    def test_setext_heading_anchor_passes(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": VALID_SKILL + "\n[Title](references/guide.md#title)\n",
                "references/guide.md": "Title\n=====\n",
            }
        )
        self.assertTrue(valid, message)

    def test_explicit_html_anchor_passes(self) -> None:
        valid, message = self.validate_tree(
            {
                "SKILL.md": VALID_SKILL + "\n[API](references/guide.md#export-button)\n",
                "references/guide.md": '<a id="export-button"></a>\n\n## Button\n',
            }
        )
        self.assertTrue(valid, message)

    def test_ui_builder_required_route_cannot_be_removed(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace(
            "[data workflow contract](references/data-workflows.md)",
            "data workflow contract",
        )
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertFalse(valid)
        self.assertIn("missing required route", message)

    def test_ui_builder_image_cannot_satisfy_required_route(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace(
            "[data workflow contract](references/data-workflows.md)",
            "![data workflow contract](references/data-workflows.md)",
        )
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertFalse(valid)
        self.assertIn("missing required route", message)

    def test_ui_builder_shortcut_reference_can_satisfy_required_route(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace(
            "[data workflow contract](references/data-workflows.md)",
            "[data workflow contract]",
        ) + "\n[data workflow contract]: references/data-workflows.md\n"
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertTrue(valid, message)

    def test_ui_builder_unused_reference_definition_cannot_satisfy_route(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace(
            "[data workflow contract](references/data-workflows.md)",
            "data workflow contract",
        ) + "\n[data workflow contract]: references/data-workflows.md\n"
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertFalse(valid)
        self.assertIn("missing required route", message)

    def test_ui_builder_core_source_contract_cannot_be_removed(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace(
            "assets/react-kit/src/personal-ui/",
            "the canonical component directory",
        )
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertFalse(valid)
        self.assertIn("canonical source contract marker", message)

    def test_ui_builder_core_contract_in_html_comment_does_not_count(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace(
            "assets/react-kit/src/personal-ui/",
            "<!-- assets/react-kit/src/personal-ui/ -->the canonical component directory",
        )
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertFalse(valid)
        self.assertIn("canonical source contract marker", message)

    def test_ui_builder_imperative_contract_in_inline_code_does_not_count(self) -> None:
        repository_root = Path(__file__).resolve().parent.parent
        skill_content = (repository_root / "SKILL.md").read_text(encoding="utf-8")
        skill_content = skill_content.replace("Do not recreate", "`Do not recreate`")
        valid, message = self.validate_tree(self.ui_builder_fixture(skill_content))
        self.assertFalse(valid)
        self.assertIn("no control recreation contract marker", message)


if __name__ == "__main__":
    unittest.main()
