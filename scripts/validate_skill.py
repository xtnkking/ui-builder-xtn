#!/usr/bin/env python3
"""Validate this Skill from a clean checkout without external Python packages."""

from __future__ import annotations

import ast
import html
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


MAX_SKILL_NAME_LENGTH = 64
ALLOWED_FRONTMATTER_KEYS = {
    "name",
    "description",
    "license",
    "allowed-tools",
    "metadata",
}
FRONTMATTER = re.compile(r"^---\n(?P<body>.*?)\n---(?:\n|$)", re.DOTALL)
TOP_LEVEL_KEY = re.compile(r"^(?P<key>[A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(?P<value>.*))?$")
REFERENCE_DEFINITION = re.compile(
    r"^[ ]{0,3}\[(?P<label>[^\]\n]+)\]:[ \t]*"
    r"(?:<(?P<angle>[^>\n]+)>|(?P<plain>\S+?))"
    r"(?:[ \t]+(?:[\"'(].*)?)?$",
    re.MULTILINE,
)
REFERENCE_USAGE = re.compile(
    r"(?P<image>!)?\[(?P<label>[^\]\n]+)\]\[(?P<reference>[^\]\n]*)\]"
)
SHORTCUT_REFERENCE = re.compile(r"(?P<image>!)?\[(?P<label>[^\]\n]+)\](?![\[(])")
MARKDOWN_HEADING = re.compile(r"^[ \t]{0,3}#{1,6}[ \t]+(?P<heading>.*?)[ \t]*#*[ \t]*$")
SETEXT_HEADING = re.compile(r"^[ ]{0,3}(?:=+|-+)[ \t]*$")
INLINE_CODE = re.compile(r"(?P<ticks>`+)(?P<body>.*?)(?P=ticks)", re.DOTALL)
HTML_ANCHOR = re.compile(
    r"<a\b[^>]*\b(?:id|name)[ \t]*=[ \t]*(?:\"(?P<double>[^\"]+)\"|'(?P<single>[^']+)')[^>]*>",
    re.IGNORECASE,
)

UI_BUILDER_REQUIRED_ROUTES = {
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
}
UI_BUILDER_CORE_MARKERS = {
    "canonical source": ("assets/react-kit/src/personal-ui/", True),
    "public barrel": ("src/personal-ui/index.ts", True),
    "Manifest ownership": ("assets/react-kit/component-manifest.json", True),
    "provenance gate": ("verify:personal-ui", True),
    "no control recreation": ("Do not recreate", False),
    "protected public Props": ("Protected public components must not receive", False),
    "missing capability gate": ("If a requested capability has no registered public export", False),
}


def _plain_scalar(value: str) -> Any:
    value = value.strip()
    if value[:1] in {"'", '"'}:
        try:
            parsed = ast.literal_eval(value)
        except (SyntaxError, ValueError) as error:
            raise ValueError(f"invalid quoted scalar: {error}") from error
        return parsed
    value = re.sub(r"\s+#.*$", "", value).rstrip()
    if value in {"null", "Null", "NULL", "~"}:
        return None
    if value in {"true", "True", "TRUE"}:
        return True
    if value in {"false", "False", "FALSE"}:
        return False
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, Any], list[str]]:
    """Parse the top-level subset used by Codex Skill frontmatter."""

    values: dict[str, Any] = {}
    errors: list[str] = []
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        index += 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith((" ", "\t")):
            errors.append(f"orphaned indented frontmatter at line {index}")
            continue
        match = TOP_LEVEL_KEY.fullmatch(line)
        if match is None:
            errors.append(f"invalid frontmatter entry at line {index}: {line!r}")
            continue
        key = match.group("key")
        raw_value = (match.group("value") or "").strip()
        if key in values:
            errors.append(f"duplicate frontmatter key: {key}")
            continue

        if raw_value in {"|", ">"}:
            block: list[str] = []
            while index < len(lines) and (
                not lines[index].strip() or lines[index].startswith((" ", "\t"))
            ):
                current = lines[index]
                index += 1
                block.append(current.lstrip() if current.strip() else "")
            values[key] = ("\n" if raw_value == "|" else " ").join(block).strip()
            continue

        if raw_value == "":
            nested: list[str] = []
            while index < len(lines) and (
                not lines[index].strip() or lines[index].startswith((" ", "\t"))
            ):
                nested.append(lines[index])
                index += 1
            values[key] = {"raw": "\n".join(nested)}
            continue

        try:
            values[key] = _plain_scalar(raw_value)
        except ValueError as error:
            errors.append(f"invalid value for {key}: {error}")
    return values, errors


def _without_markdown_code(content: str, *, keep_inline_text: bool = False) -> str:
    """Remove fenced, indented, and inline code while preserving line boundaries."""

    output: list[str] = []
    fence_marker: str | None = None
    fence_length = 0
    for line in content.splitlines():
        candidate = line
        while True:
            quote = re.match(r"^[ ]{0,3}>[ \t]?", candidate)
            if quote is None:
                break
            candidate = candidate[quote.end() :]
        list_item = re.match(r"^[ ]{0,3}(?:[-+*]|\d+[.)])[ \t]+", candidate)
        if list_item is not None:
            candidate = candidate[list_item.end() :]

        indented = candidate.startswith(("    ", "\t"))
        fence = None if indented else re.match(r"^[ ]{0,3}(`{3,}|~{3,})(.*)$", candidate)
        if (
            fence is not None
            and fence_marker is None
            and fence.group(1).startswith("`")
            and "`" in fence.group(2)
        ):
            fence = None
        if fence:
            marker = fence.group(1)
            if fence_marker is None:
                fence_marker = marker[0]
                fence_length = len(marker)
            elif marker[0] == fence_marker and len(marker) >= fence_length:
                if not fence.group(2).strip():
                    fence_marker = None
                    fence_length = 0
            output.append("")
            continue
        if fence_marker is not None or indented:
            output.append("")
            continue
        output.append(line)
    visible = "\n".join(output)
    visible = re.sub(r"<!--.*?-->", "", visible, flags=re.DOTALL)
    return INLINE_CODE.sub(
        (lambda match: match.group("body")) if keep_inline_text else "",
        visible,
    )


def _reference_label(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _inline_markdown_links(content: str) -> list[tuple[str, bool, str, int, int]]:
    """Parse inline links with balanced bare destinations and return source spans."""

    links: list[tuple[str, bool, str, int, int]] = []

    def is_escaped(position: int) -> bool:
        slashes = 0
        position -= 1
        while position >= 0 and content[position] == "\\":
            slashes += 1
            position -= 1
        return slashes % 2 == 1

    index = 0
    while index < len(content):
        image = content[index] == "!" and index + 1 < len(content) and content[index + 1] == "["
        if image:
            start = index
            label_start = index + 2
        elif content[index] == "[":
            start = index
            label_start = index + 1
        else:
            index += 1
            continue

        if is_escaped(start):
            index = label_start
            continue

        label_end = -1
        label_depth = 0
        cursor = label_start
        while cursor < len(content):
            if content[cursor] == "\\":
                cursor += 2
                continue
            if content[cursor] == "[":
                label_depth += 1
            elif content[cursor] == "]":
                if label_depth == 0:
                    label_end = cursor
                    break
                label_depth -= 1
            cursor += 1
        if label_end < 0 or label_end + 1 >= len(content) or content[label_end + 1] != "(":
            index = label_start
            continue
        cursor = label_end + 2
        while cursor < len(content) and content[cursor] in " \t":
            cursor += 1
        if cursor >= len(content):
            break

        if content[cursor] == "<":
            target_start = cursor + 1
            target_end = content.find(">", target_start)
            if target_end < 0:
                index = label_end + 1
                continue
            cursor = target_end + 1
        else:
            target_start = cursor
            depth = 0
            destination_escaped = False
            while cursor < len(content):
                character = content[cursor]
                if destination_escaped:
                    destination_escaped = False
                    cursor += 1
                    continue
                if character == "\\":
                    destination_escaped = True
                    cursor += 1
                    continue
                if character == "(":
                    depth += 1
                elif character == ")":
                    if depth == 0:
                        break
                    depth -= 1
                elif character in " \t\n" and depth == 0:
                    break
                cursor += 1
            target_end = cursor

        target = content[target_start:target_end]
        cursor = target_end if content[target_end:target_end + 1] != ">" else target_end + 1
        while cursor < len(content) and content[cursor] in " \t":
            cursor += 1
        if cursor < len(content) and content[cursor] in {'"', "'"}:
            quote = content[cursor]
            cursor += 1
            while cursor < len(content) and content[cursor] != quote:
                cursor += 2 if content[cursor] == "\\" else 1
            if cursor < len(content):
                cursor += 1
            while cursor < len(content) and content[cursor] in " \t":
                cursor += 1
        elif cursor < len(content) and content[cursor] == "(":
            cursor += 1
            escaped_title = False
            while cursor < len(content):
                if escaped_title:
                    escaped_title = False
                elif content[cursor] == "\\":
                    escaped_title = True
                elif content[cursor] == ")":
                    cursor += 1
                    break
                cursor += 1
            while cursor < len(content) and content[cursor] in " \t":
                cursor += 1
        if cursor >= len(content) or content[cursor] != ")":
            index = label_end + 1
            continue

        target = re.sub(r"\\([\\()[\] ])", r"\1", target)
        label = re.sub(r"\\([\\[\]])", r"\1", content[label_start:label_end])
        links.append((target, image, label, start, cursor + 1))
        index = cursor + 1
    return links


def _markdown_link_data(content: str) -> tuple[set[str], set[str], set[str]]:
    """Return all targets, navigational targets, and undefined explicit references."""

    visible = _without_markdown_code(content)
    all_targets: set[str] = set()
    routes: set[str] = set()
    definitions: dict[str, str] = {}

    for match in REFERENCE_DEFINITION.finditer(visible):
        target = match.group("angle") or match.group("plain") or ""
        definitions[_reference_label(match.group("label"))] = target
        all_targets.add(target)

    for target, image, _, _, _ in _inline_markdown_links(visible):
        all_targets.add(target)
        if not image:
            routes.add(target)

    undefined: set[str] = set()
    for match in REFERENCE_USAGE.finditer(visible):
        reference = _reference_label(match.group("reference") or match.group("label"))
        target = definitions.get(reference)
        if target is None:
            undefined.add(reference)
            continue
        if match.group("image") is None:
            routes.add(target)

    shortcut_content = REFERENCE_DEFINITION.sub("", visible)
    for match in SHORTCUT_REFERENCE.finditer(shortcut_content):
        reference = _reference_label(match.group("label"))
        target = definitions.get(reference)
        if target is not None and match.group("image") is None:
            routes.add(target)

    return all_targets, routes, undefined


def _rendered_heading_text(heading: str) -> str:
    heading = html.unescape(heading)
    for _, _, label, start, end in reversed(_inline_markdown_links(heading)):
        heading = heading[:start] + label + heading[end:]
    heading = re.sub(r"!?\[([^\]]*)\]\[[^\]]*\]", r"\1", heading)
    heading = re.sub(r"<[^>]*>", "", heading)
    heading = re.sub(r"(?<!\w)(_{1,3})(?=\S)(.+?)(?<=\S)\1(?!\w)", r"\2", heading)
    heading = re.sub(r"(?<!\w)(\*{1,3})(?=\S)(.+?)(?<=\S)\1(?!\w)", r"\2", heading)
    return heading.replace("~", "")


def _heading_anchors(content: str) -> set[str]:
    visible = _without_markdown_code(content, keep_inline_text=True)
    anchors = {
        html.unescape(match.group("double") or match.group("single") or "").strip().lower()
        for match in HTML_ANCHOR.finditer(visible)
        if (match.group("double") or match.group("single") or "").strip()
    }
    lines = visible.splitlines()
    headings: list[str] = []
    for index, line in enumerate(lines):
        match = MARKDOWN_HEADING.match(line)
        if match is not None:
            headings.append(match.group("heading"))
        elif line.strip() and index + 1 < len(lines) and SETEXT_HEADING.match(lines[index + 1]):
            headings.append(line.strip())

    for heading in headings:
        heading = _rendered_heading_text(heading)
        base = re.sub(r"[^\w\s-]", "", heading, flags=re.UNICODE).strip().lower()
        base = re.sub(r"\s", "-", base)
        if not base:
            continue
        anchor = base
        suffix = 1
        while anchor in anchors:
            anchor = f"{base}-{suffix}"
            suffix += 1
        anchors.add(anchor)
    return anchors


def _markdown_documents(skill_path: Path) -> list[Path]:
    documents = [skill_path / "SKILL.md"]
    readme = skill_path / "README.md"
    if readme.is_file():
        documents.append(readme)
    references = skill_path / "references"
    if references.is_dir():
        documents.extend(sorted(references.rglob("*.md")))
    return documents


def _validate_markdown_links(skill_path: Path, errors: list[str]) -> None:
    root = skill_path.resolve()
    documents = _markdown_documents(root)
    cached_content: dict[Path, str] = {}
    cached_anchors: dict[Path, set[str]] = {}

    for document in documents:
        try:
            content = document.read_text(encoding="utf-8").replace("\r\n", "\n")
        except OSError as error:
            errors.append(f"unable to read Markdown document {document}: {error}")
            continue
        cached_content[document.resolve()] = content
        targets, _, undefined_references = _markdown_link_data(content)
        for reference in sorted(undefined_references):
            errors.append(
                f"undefined Markdown reference in {document.relative_to(root)}: {reference}"
            )
        for raw_target in sorted(targets):
            parsed = urlsplit(raw_target)
            if parsed.scheme or parsed.netloc or raw_target.startswith("/"):
                continue
            relative_path = unquote(parsed.path)
            fragment = unquote(parsed.fragment).strip().lower()
            target = document.resolve() if not relative_path else (document.parent / relative_path).resolve()
            try:
                target.relative_to(root)
            except ValueError:
                errors.append(
                    f"Markdown link escapes the Skill root in {document.relative_to(root)}: {raw_target}"
                )
                continue
            if not target.exists():
                errors.append(
                    f"broken Markdown link in {document.relative_to(root)}: {raw_target}"
                )
                continue
            if fragment and target.suffix.lower() == ".md":
                target_content = cached_content.get(target)
                if target_content is None:
                    try:
                        target_content = target.read_text(encoding="utf-8").replace("\r\n", "\n")
                    except OSError as error:
                        errors.append(f"unable to read Markdown target {target}: {error}")
                        continue
                    cached_content[target] = target_content
                anchors = cached_anchors.setdefault(target, _heading_anchors(target_content))
                if fragment not in anchors:
                    errors.append(
                        f"broken Markdown anchor in {document.relative_to(root)}: {raw_target}"
                    )


def _validate_ui_builder_contract(
    skill_path: Path,
    body: str,
    errors: list[str],
) -> None:
    _, routes, _ = _markdown_link_data(body)
    linked_paths = {target.split("#", 1)[0] for target in routes}
    missing_routes = sorted(UI_BUILDER_REQUIRED_ROUTES - linked_paths)
    if missing_routes:
        errors.append("ui-builder-xtn is missing required route(s): " + ", ".join(missing_routes))

    visible_body = _without_markdown_code(body)
    visible_body_with_inline = _without_markdown_code(body, keep_inline_text=True)
    for label, (marker, allow_inline) in UI_BUILDER_CORE_MARKERS.items():
        searchable_body = visible_body_with_inline if allow_inline else visible_body
        if marker not in searchable_body:
            errors.append(f"ui-builder-xtn lost its {label} contract marker: {marker}")

    if len(body.splitlines()) > 80:
        errors.append("ui-builder-xtn SKILL.md body exceeds the 80-line routing budget")


def validate_skill(skill_path: Path | str) -> tuple[bool, str]:
    skill_path = Path(skill_path).resolve()
    skill_md = skill_path / "SKILL.md"
    if not skill_md.is_file():
        return False, f"SKILL.md not found: {skill_md}"
    try:
        content = skill_md.read_text(encoding="utf-8").replace("\r\n", "\n")
    except OSError as error:
        return False, f"unable to read SKILL.md: {error}"
    match = FRONTMATTER.match(content)
    if match is None:
        return False, "SKILL.md must start with a closed YAML frontmatter block"

    frontmatter, errors = parse_frontmatter(match.group("body"))
    unexpected = sorted(set(frontmatter) - ALLOWED_FRONTMATTER_KEYS)
    if unexpected:
        errors.append(
            "unexpected frontmatter key(s): " + ", ".join(unexpected)
        )
    for key in ("name", "description"):
        if key not in frontmatter:
            errors.append(f"missing required frontmatter key: {key}")

    name = frontmatter.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("frontmatter name must be a non-empty string")
    else:
        name = name.strip()
        if not re.fullmatch(r"[a-z0-9-]+", name):
            errors.append("frontmatter name must use lowercase hyphen-case")
        if name.startswith("-") or name.endswith("-") or "--" in name:
            errors.append(
                "frontmatter name cannot start/end with a hyphen or contain consecutive hyphens"
            )
        if len(name) > MAX_SKILL_NAME_LENGTH:
            errors.append(
                f"frontmatter name exceeds {MAX_SKILL_NAME_LENGTH} characters"
            )

    description = frontmatter.get("description")
    if not isinstance(description, str) or not description.strip():
        errors.append("frontmatter description must be a non-empty string")
    else:
        description = description.strip()
        if description.startswith("[TODO:"):
            errors.append("frontmatter description contains an unfinished TODO")
        if "<" in description or ">" in description:
            errors.append("frontmatter description cannot contain angle brackets")
        if len(description) > 1024:
            errors.append("frontmatter description exceeds 1024 characters")

    body = content[match.end() :]
    visible_body = _without_markdown_code(body)
    for line_number, line in enumerate(visible_body.splitlines(), start=1):
        if re.fullmatch(r"[ ]{0,3}\[TODO:[^\n]*\][ \t]*", line):
            errors.append(
                f"Skill instructions contain an unfinished TODO at body line {line_number}"
            )

    _validate_markdown_links(skill_path, errors)
    if name == "ui-builder-xtn":
        _validate_ui_builder_contract(skill_path, body, errors)

    if errors:
        return False, "Invalid Skill:\n- " + "\n- ".join(errors)
    return True, "Skill is valid"


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/validate_skill.py <skill-directory>")
        return 2
    valid, message = validate_skill(sys.argv[1])
    print(message)
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
