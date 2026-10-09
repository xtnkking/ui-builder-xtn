#!/usr/bin/env python3
"""Explicit, resumable Git/GitHub/generated-copy publication adapter.

This module is inert until ``release_personal_ui.py publish --execute`` calls it.
Credentials are obtained from Git's credential helper for each process and are
never returned to the release journal or included in command arguments.
"""

from __future__ import annotations

import dataclasses
import datetime as dt
import json
import mimetypes
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath
from typing import Mapping, Sequence

try:
    from . import release_personal_ui as release
except ImportError:
    import release_personal_ui as release


GENERATED_COPY_MANIFEST = ".ui-builder-xtn-generated-copy.json"
GENERATED_COPY_KIND = "personal-ui-generated-copy"
PLAN_MARKER_PREFIX = "ui-builder-xtn-plan-digest:"


class GitHubRequestError(release.ReleaseError):
    def __init__(self, status: int, operation: str) -> None:
        self.status = status
        super().__init__(f"GitHub {operation} failed with HTTP {status}")


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Do not forward a GitHub bearer credential to an asset CDN host."""

    def redirect_request(  # type: ignore[override]
        self, request: urllib.request.Request, *args: object, **kwargs: object
    ) -> urllib.request.Request | None:
        redirected = super().redirect_request(request, *args, **kwargs)
        if redirected is None:
            return None
        old_host = urllib.parse.urlsplit(request.full_url).hostname
        new_host = urllib.parse.urlsplit(redirected.full_url).hostname
        if old_host != new_host:
            redirected.remove_header("Authorization")
        return redirected


@dataclasses.dataclass(frozen=True)
class _SyncPlan:
    target: Path
    candidate_files: Mapping[str, bytes]
    remove: tuple[str, ...]


@dataclasses.dataclass
class GitHubPublishAdapter:
    repository_root: Path
    remote: str = "origin"
    repository: str | None = None
    generated_copy_targets: Sequence[Path] = ()
    api_base: str = "https://api.github.com"
    uploads_base: str = "https://uploads.github.com"
    _credential: str | None = dataclasses.field(default=None, init=False, repr=False)

    def preflight(
        self,
        plan: Mapping[str, object],
        candidate: Path,
        journal: Mapping[str, object],
    ) -> list[str]:
        blockers: list[str] = []
        try:
            self._validate_repository(plan, journal)
        except release.ReleaseError as error:
            blockers.append(self._blocker(error))
        try:
            files = release.collect_staged_files(candidate.resolve())
            self._plan_generated_copy_sync(plan, candidate.resolve(), files)
        except release.ReleaseError as error:
            blockers.append(self._blocker(error))
        return sorted(set(blockers))

    def execute(
        self,
        step: str,
        plan: Mapping[str, object],
        candidate: Path,
    ) -> Mapping[str, object]:
        dispatch = {
            "freeze-release-commit": self._freeze_release_commit,
            "create-immutable-tag": self._create_immutable_tag,
            "push-release-source-and-tag": self._push_release_source_and_tag,
            "create-draft-github-release": self._create_draft_github_release,
            "upload-artifacts-and-checksums": self._upload_artifacts,
            "verify-remote-identity": self._verify_remote_identity,
            "publish-github-release": self._publish_github_release,
            "sync-explicit-generated-copies": self._sync_generated_copies,
        }
        handler = dispatch.get(step)
        if handler is None:
            raise release.ReleaseError(f"unsupported publication step: {step}")
        return handler(plan, candidate.resolve())

    @staticmethod
    def _blocker(error: release.ReleaseError) -> str:
        value = str(error)
        if value.startswith("publisher-"):
            return value
        return f"publisher-preflight:{type(error).__name__}"

    @property
    def root(self) -> Path:
        return self.repository_root.resolve()

    def _git(
        self,
        *args: str,
        cwd: Path | None = None,
        input_bytes: bytes | None = None,
        environment: Mapping[str, str] | None = None,
    ) -> bytes:
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"
        if environment:
            env.update(environment)
        process = subprocess.run(
            ["git", *args],
            cwd=cwd or self.root,
            input=input_bytes,
            capture_output=True,
            check=False,
            env=env,
        )
        if process.returncode != 0:
            operation = args[0] if args else "command"
            raise release.ReleaseError(
                f"publisher-git-{operation}-failed:{process.returncode}"
            )
        return process.stdout

    def _git_text(self, *args: str, cwd: Path | None = None) -> str:
        return self._git(*args, cwd=cwd).decode("utf-8", errors="strict").strip()

    def _repository_slug(self) -> str:
        if self.repository is not None:
            slug = self.repository.strip().strip("/")
        else:
            url = self._git_text("remote", "get-url", self.remote)
            match = re.fullmatch(
                r"(?:https://github\.com/|ssh://git@github\.com/|git@github\.com:)"
                r"([^/\s]+/[^/\s]+?)(?:\.git)?",
                url,
            )
            if match is None:
                raise release.ReleaseError("publisher-github-origin-unsupported")
            slug = match.group(1)
        if re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", slug) is None:
            raise release.ReleaseError("publisher-github-repository-invalid")
        return slug

    @staticmethod
    def _source_commit(plan: Mapping[str, object]) -> str:
        source = plan.get("source")
        commit = source.get("commit") if isinstance(source, Mapping) else None
        if not isinstance(commit, str) or re.fullmatch(r"[0-9a-f]{40}", commit) is None:
            raise release.ReleaseError("publisher-source-commit-invalid")
        return commit

    @staticmethod
    def _version(plan: Mapping[str, object]) -> str:
        version = plan.get("candidateVersion")
        if not isinstance(version, str):
            raise release.ReleaseError("publisher-candidate-version-invalid")
        release.SemVer.parse(version)
        return version

    @staticmethod
    def _plan_digest(plan: Mapping[str, object]) -> str:
        digest = plan.get("planDigest")
        if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
            raise release.ReleaseError("publisher-plan-digest-invalid")
        return digest

    def _marker(self, plan: Mapping[str, object]) -> str:
        return f"{PLAN_MARKER_PREFIX}{self._plan_digest(plan)}"

    def _journal(self, candidate: Path) -> Mapping[str, object]:
        _plan, journal = release.load_candidate(candidate)
        return journal

    def _step_result(
        self,
        candidate: Path,
        step: str,
        *,
        required: bool = True,
    ) -> Mapping[str, object]:
        journal = self._journal(candidate)
        steps = journal.get("steps")
        state = steps.get(step) if isinstance(steps, Mapping) else None
        result = state.get("result") if isinstance(state, Mapping) else None
        if isinstance(result, Mapping):
            return result
        if required:
            raise release.ReleaseError(f"publisher-prior-step-result-missing:{step}")
        return {}

    def _candidate_matches_worktree(
        self, plan: Mapping[str, object], root: Path
    ) -> bool:
        try:
            files = release.collect_worktree_files(root)
        except release.ReleaseError:
            return False
        return release.digest_file_map(files) == plan.get("candidateContentDigest")

    def _is_release_commit(self, plan: Mapping[str, object], commit: str) -> bool:
        head = self._git_text("rev-parse", "--verify", f"{commit}^{{commit}}")
        if head != commit:
            return False
        message = self._git_text("show", "-s", "--format=%B", commit)
        if self._marker(plan) not in message:
            return False
        current = self._git_text("rev-parse", "HEAD")
        return current == commit and self._candidate_matches_worktree(plan, self.root)

    def _validate_repository(
        self, plan: Mapping[str, object], journal: Mapping[str, object]
    ) -> None:
        if not self.repository_root.is_absolute():
            raise release.ReleaseError("publisher-repository-root-must-be-absolute")
        if not self.root.is_dir() or not (self.root / ".git").exists():
            raise release.ReleaseError("publisher-repository-root-invalid")
        if not self.remote or self.remote.startswith("-"):
            raise release.ReleaseError("publisher-remote-invalid")
        self._repository_slug()
        branch = self._git_text("symbolic-ref", "--quiet", "--short", "HEAD")
        if not branch or branch.startswith("-"):
            raise release.ReleaseError("publisher-detached-head-not-supported")
        if self._git_text("status", "--porcelain=v1", "--untracked-files=all"):
            raise release.ReleaseError("publisher-repository-not-clean")
        head = self._git_text("rev-parse", "HEAD")
        source_commit = self._source_commit(plan)
        if head != source_commit and not self._is_release_commit(plan, head):
            raise release.ReleaseError("publisher-repository-head-conflict")

        version = self._version(plan)
        tag = f"v{version}"
        tags = set(self._git_text("tag", "--list", tag).splitlines())
        steps = journal.get("steps")
        tag_state = steps.get("create-immutable-tag") if isinstance(steps, Mapping) else None
        resumable = isinstance(tag_state, Mapping) and tag_state.get("status") in {
            "running",
            "failed",
            "complete",
        }
        if tag in tags and not resumable:
            raise release.ReleaseError("publisher-local-tag-already-exists")
        if tag in tags:
            target = self._git_text("rev-parse", f"refs/tags/{tag}^{{commit}}")
            if target != head or not self._is_annotated_owned_tag(tag, plan):
                raise release.ReleaseError("publisher-local-tag-conflict")

    def _freeze_release_commit(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        source_commit = self._source_commit(plan)
        head = self._git_text("rev-parse", "HEAD")
        if head != source_commit:
            if self._is_release_commit(plan, head):
                return {
                    "releaseCommit": head,
                    "sourceCommit": source_commit,
                    "planDigest": self._plan_digest(plan),
                }
            raise release.ReleaseError("publisher-repository-head-conflict")
        if self._git_text("status", "--porcelain=v1", "--untracked-files=all"):
            raise release.ReleaseError("publisher-repository-not-clean")

        files = release.collect_staged_files(candidate)
        release.verify_candidate_files(plan, files)
        source = plan.get("source")
        epoch = source.get("sourceDateEpoch") if isinstance(source, Mapping) else None
        if not isinstance(epoch, int) or isinstance(epoch, bool):
            raise release.ReleaseError("publisher-source-epoch-invalid")
        timestamp = dt.datetime.fromtimestamp(epoch, tz=dt.timezone.utc).isoformat()
        environment = {
            "GIT_AUTHOR_DATE": timestamp,
            "GIT_COMMITTER_DATE": timestamp,
        }
        temporary = Path(tempfile.mkdtemp(prefix="ui-builder-xtn-release-"))
        worktree = temporary / "worktree"
        added = False
        try:
            self._git("worktree", "add", "--detach", str(worktree), source_commit)
            added = True
            release._write_files(worktree, files)
            self._git("add", "--all", cwd=worktree)
            message = f"Release v{self._version(plan)}"
            self._git(
                "commit",
                "-m",
                message,
                "-m",
                self._marker(plan),
                cwd=worktree,
                environment=environment,
            )
            release_commit = self._git_text("rev-parse", "HEAD", cwd=worktree)
            committed_files = release.collect_worktree_files(worktree)
            release.verify_candidate_files(plan, committed_files)
            self._git("merge", "--ff-only", release_commit)
        finally:
            if added:
                try:
                    self._git("worktree", "remove", "--force", str(worktree))
                except release.ReleaseError:
                    pass
            try:
                temporary.rmdir()
            except OSError:
                pass
        if self._git_text("rev-parse", "HEAD") != release_commit:
            raise release.ReleaseError("publisher-release-commit-not-checked-out")
        if not self._candidate_matches_worktree(plan, self.root):
            raise release.ReleaseError("publisher-release-commit-content-mismatch")
        return {
            "releaseCommit": release_commit,
            "sourceCommit": source_commit,
            "planDigest": self._plan_digest(plan),
        }

    def _release_commit(self, plan: Mapping[str, object], candidate: Path) -> str:
        result = self._step_result(candidate, "freeze-release-commit", required=False)
        commit = result.get("releaseCommit")
        if isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit):
            return commit
        head = self._git_text("rev-parse", "HEAD")
        if self._is_release_commit(plan, head):
            return head
        raise release.ReleaseError("publisher-release-commit-unavailable")

    def _is_annotated_owned_tag(
        self, tag: str, plan: Mapping[str, object]
    ) -> bool:
        try:
            if self._git_text("cat-file", "-t", f"refs/tags/{tag}") != "tag":
                return False
            contents = self._git_text(
                "for-each-ref", "--format=%(contents)", f"refs/tags/{tag}"
            )
            return self._marker(plan) in contents
        except release.ReleaseError:
            return False

    def _create_immutable_tag(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        commit = self._release_commit(plan, candidate)
        tag = f"v{self._version(plan)}"
        if self._git_text("tag", "--list", tag):
            existing = self._git_text("rev-parse", f"refs/tags/{tag}^{{commit}}")
            if existing != commit or not self._is_annotated_owned_tag(tag, plan):
                raise release.ReleaseError("publisher-local-tag-conflict")
        else:
            self._git(
                "tag",
                "-a",
                tag,
                commit,
                "-m",
                f"ui-builder-xtn {self._version(plan)}",
                "-m",
                self._marker(plan),
            )
        return {"tag": tag, "releaseCommit": commit, "immutable": True}

    def _remote_refs(
        self, branch: str, tag: str
    ) -> tuple[str | None, str | None, str | None]:
        output = self._git_text(
            "ls-remote",
            self.remote,
            f"refs/heads/{branch}",
            f"refs/tags/{tag}",
            f"refs/tags/{tag}^{{}}",
        )
        refs: dict[str, str] = {}
        for line in output.splitlines():
            fields = line.split("\t", 1)
            if len(fields) == 2:
                refs[fields[1]] = fields[0]
        tag_ref = refs.get(f"refs/tags/{tag}")
        tag_commit = refs.get(f"refs/tags/{tag}^{{}}") or tag_ref
        return refs.get(f"refs/heads/{branch}"), tag_ref, tag_commit

    def _push_release_source_and_tag(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        commit = self._release_commit(plan, candidate)
        tag_result = self._step_result(candidate, "create-immutable-tag")
        tag = tag_result.get("tag")
        if not isinstance(tag, str):
            raise release.ReleaseError("publisher-tag-result-invalid")
        branch = self._git_text("symbolic-ref", "--quiet", "--short", "HEAD")
        local_tag_ref = self._git_text("rev-parse", f"refs/tags/{tag}")
        remote_branch, remote_tag_ref, remote_tag_commit = self._remote_refs(
            branch, tag
        )
        if remote_tag_ref is not None and (
            remote_tag_ref != local_tag_ref or remote_tag_commit != commit
        ):
            raise release.ReleaseError("publisher-public-tag-conflict")
        if remote_branch != commit or remote_tag_ref != local_tag_ref:
            self._git(
                "push",
                "--atomic",
                self.remote,
                f"HEAD:refs/heads/{branch}",
                f"refs/tags/{tag}:refs/tags/{tag}",
            )
            remote_branch, remote_tag_ref, remote_tag_commit = self._remote_refs(
                branch, tag
            )
        if (
            remote_branch != commit
            or remote_tag_ref != local_tag_ref
            or remote_tag_commit != commit
        ):
            raise release.ReleaseError("publisher-remote-ref-verification-failed")
        return {
            "remote": self.remote,
            "branch": branch,
            "tag": tag,
            "releaseCommit": commit,
        }

    def _github_token(self) -> str:
        if self._credential is not None:
            return self._credential
        slug = self._repository_slug()
        request = (
            f"protocol=https\nhost=github.com\npath={slug}.git\n\n"
        ).encode("utf-8")
        output = self._git("credential", "fill", input_bytes=request)
        fields: dict[str, str] = {}
        for line in output.decode("utf-8", errors="strict").splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                fields[key] = value
        credential = fields.get("password")
        if not credential:
            raise release.ReleaseError("publisher-github-credential-unavailable")
        self._credential = credential
        return credential

    def _http(
        self,
        method: str,
        url: str,
        *,
        body: bytes | None = None,
        content_type: str | None = None,
        accept: str = "application/vnd.github+json",
    ) -> tuple[int, bytes]:
        headers = {
            "Accept": accept,
            "Authorization": f"Bearer {self._github_token()}",
            "User-Agent": "ui-builder-xtn-release",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if content_type:
            headers["Content-Type"] = content_type
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            opener = urllib.request.build_opener(_SafeRedirectHandler())
            with opener.open(request, timeout=60) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            raise GitHubRequestError(error.code, method.lower()) from None
        except urllib.error.URLError:
            raise release.ReleaseError(f"GitHub {method.lower()} request failed") from None

    def _api_json(
        self,
        method: str,
        path: str,
        *,
        payload: Mapping[str, object] | None = None,
        expected: Sequence[int] = (200,),
    ) -> object:
        body = release.canonical_json_bytes(payload) if payload is not None else None
        status, content = self._http(
            method,
            f"{self.api_base.rstrip('/')}{path}",
            body=body,
            content_type="application/json" if body is not None else None,
        )
        if status not in expected:
            raise GitHubRequestError(status, method.lower())
        try:
            return json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise release.ReleaseError("publisher-github-response-invalid") from None

    def _release_by_tag(
        self, tag: str, *, missing_ok: bool
    ) -> Mapping[str, object] | None:
        slug = self._repository_slug()
        path = f"/repos/{slug}/releases/tags/{urllib.parse.quote(tag, safe='')}"
        try:
            value = self._api_json("GET", path)
        except GitHubRequestError as error:
            if missing_ok and error.status == 404:
                return None
            raise
        if not isinstance(value, Mapping):
            raise release.ReleaseError("publisher-github-release-response-invalid")
        return value

    def _assert_owned_release(
        self, value: Mapping[str, object], plan: Mapping[str, object]
    ) -> None:
        body = value.get("body")
        tag = value.get("tag_name")
        if tag != f"v{self._version(plan)}" or not isinstance(body, str):
            raise release.ReleaseError("publisher-github-release-conflict")
        if f"<!-- {self._marker(plan)} -->" not in body:
            raise release.ReleaseError("publisher-github-release-conflict")
        release_id = value.get("id")
        if not isinstance(release_id, int) or isinstance(release_id, bool) or release_id <= 0:
            raise release.ReleaseError("publisher-github-release-id-invalid")

    @staticmethod
    def _completed_result(
        journal: Mapping[str, object], step: str
    ) -> Mapping[str, object]:
        steps = journal.get("steps")
        state = steps.get(step) if isinstance(steps, Mapping) else None
        result = state.get("result") if isinstance(state, Mapping) else None
        if (
            not isinstance(state, Mapping)
            or state.get("status") != "complete"
            or not isinstance(result, Mapping)
        ):
            raise release.ReleaseError(f"publisher-prior-step-result-missing:{step}")
        return result

    def _assert_recorded_release_identity(
        self,
        value: Mapping[str, object],
        plan: Mapping[str, object],
        *,
        release_id: int,
        commit: str,
        allowed_draft_states: Sequence[bool],
    ) -> None:
        self._assert_owned_release(value, plan)
        if value.get("id") != release_id:
            raise release.ReleaseError("publisher-github-release-id-conflict")
        if value.get("target_commitish") != commit:
            raise release.ReleaseError("publisher-github-release-commit-conflict")
        if not any(value.get("draft") is state for state in allowed_draft_states):
            raise release.ReleaseError("publisher-github-release-state-conflict")

    def _recorded_owned_release(
        self,
        plan: Mapping[str, object],
        candidate: Path,
        *,
        expected_release_id: object | None = None,
        allow_published: bool = False,
    ) -> Mapping[str, object]:
        """Resolve the exact journal-owned draft, which tag lookup can omit.

        The journal remains authoritative on resume. Missing or conflicting
        identity is an error, never permission to create another release.
        """
        journal = self._journal(candidate)
        if journal.get("planDigest") != self._plan_digest(plan):
            raise release.ReleaseError("publisher-journal-plan-conflict")
        frozen = self._completed_result(journal, "freeze-release-commit")
        commit = frozen.get("releaseCommit")
        if (
            not isinstance(commit, str)
            or re.fullmatch(r"[0-9a-f]{40}", commit) is None
            or frozen.get("planDigest") != self._plan_digest(plan)
            or frozen.get("sourceCommit") != self._source_commit(plan)
        ):
            raise release.ReleaseError("publisher-frozen-release-identity-conflict")
        draft = self._completed_result(journal, "create-draft-github-release")
        release_id = draft.get("releaseId")
        if (
            not isinstance(release_id, int)
            or isinstance(release_id, bool)
            or release_id <= 0
        ):
            raise release.ReleaseError("publisher-github-release-id-invalid")
        if (
            draft.get("tag") != f"v{self._version(plan)}"
            or draft.get("draft") is not True
        ):
            raise release.ReleaseError("publisher-recorded-draft-identity-conflict")
        if expected_release_id is not None and (
            not isinstance(expected_release_id, int)
            or isinstance(expected_release_id, bool)
            or expected_release_id != release_id
        ):
            raise release.ReleaseError("publisher-github-release-id-conflict")
        slug = self._repository_slug()
        value = self._api_json("GET", f"/repos/{slug}/releases/{release_id}")
        if not isinstance(value, Mapping):
            raise release.ReleaseError("publisher-github-release-response-invalid")
        self._assert_recorded_release_identity(
            value,
            plan,
            release_id=release_id,
            commit=commit,
            allowed_draft_states=(True, False) if allow_published else (True,),
        )
        return value

    def _create_draft_github_release(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        tag = f"v{self._version(plan)}"
        existing = self._release_by_tag(tag, missing_ok=True)
        if existing is None:
            notes = (candidate / "artifacts" / release.NOTES_NAME).read_text("utf-8")
            slug = self._repository_slug()
            version = release.SemVer.parse(self._version(plan))
            value = self._api_json(
                "POST",
                f"/repos/{slug}/releases",
                payload={
                    "tag_name": tag,
                    "target_commitish": self._release_commit(plan, candidate),
                    "name": f"ui-builder-xtn {self._version(plan)}",
                    "body": f"<!-- {self._marker(plan)} -->\n\n{notes}",
                    "draft": True,
                    "prerelease": bool(version.prerelease),
                },
                expected=(201,),
            )
            if not isinstance(value, Mapping):
                raise release.ReleaseError("publisher-github-release-response-invalid")
            existing = value
        self._assert_owned_release(existing, plan)
        if existing.get("draft") is not True:
            raise release.ReleaseError("publisher-github-release-already-public")
        return {
            "releaseId": existing["id"],
            "releaseUrl": str(existing.get("html_url", "")),
            "tag": tag,
            "draft": True,
        }

    def _artifact_files(
        self, plan: Mapping[str, object], candidate: Path
    ) -> dict[str, bytes]:
        artifacts = plan.get("artifacts")
        if not isinstance(artifacts, Mapping):
            raise release.ReleaseError("publisher-artifact-plan-invalid")
        result: dict[str, bytes] = {}
        for key in ("archive", "manifest", "releaseNotes", "checksums"):
            metadata = artifacts.get(key)
            relative = metadata.get("path") if isinstance(metadata, Mapping) else None
            digest = metadata.get("sha256") if isinstance(metadata, Mapping) else None
            size = metadata.get("size") if isinstance(metadata, Mapping) else None
            if (
                not isinstance(relative, str)
                or not isinstance(digest, str)
                or not isinstance(size, int)
            ):
                raise release.ReleaseError("publisher-artifact-plan-invalid")
            path = release.validate_relative_path(relative)
            content = candidate.joinpath(*path.parts).read_bytes()
            if len(content) != size or release.sha256_bytes(content) != digest:
                raise release.ReleaseError("publisher-artifact-content-mismatch")
            result[path.name] = content
        return result

    def _release_assets(self, release_id: int) -> list[Mapping[str, object]]:
        slug = self._repository_slug()
        value = self._api_json(
            "GET", f"/repos/{slug}/releases/{release_id}/assets?per_page=100"
        )
        if not isinstance(value, list) or not all(isinstance(item, Mapping) for item in value):
            raise release.ReleaseError("publisher-github-assets-response-invalid")
        return list(value)

    def _download_asset(self, asset_id: int) -> bytes:
        slug = self._repository_slug()
        status, content = self._http(
            "GET",
            f"{self.api_base.rstrip('/')}/repos/{slug}/releases/assets/{asset_id}",
            accept="application/octet-stream",
        )
        if status != 200:
            raise GitHubRequestError(status, "download-asset")
        return content

    def _asset_records(
        self, release_id: int, expected_files: Mapping[str, bytes]
    ) -> list[dict[str, object]]:
        assets = self._release_assets(release_id)
        by_name = {item.get("name"): item for item in assets if isinstance(item.get("name"), str)}
        records: list[dict[str, object]] = []
        for name, expected in sorted(expected_files.items()):
            asset = by_name.get(name)
            asset_id = asset.get("id") if isinstance(asset, Mapping) else None
            if not isinstance(asset_id, int):
                raise release.ReleaseError(f"publisher-github-asset-missing:{name}")
            downloaded = self._download_asset(asset_id)
            if downloaded != expected:
                raise release.ReleaseError(f"publisher-github-asset-conflict:{name}")
            records.append(
                {
                    "name": name,
                    "assetId": asset_id,
                    "size": len(expected),
                    "sha256": release.sha256_bytes(expected),
                }
            )
        return records

    def _upload_artifacts(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        draft = self._step_result(candidate, "create-draft-github-release")
        release_id = draft.get("releaseId")
        if not isinstance(release_id, int):
            raise release.ReleaseError("publisher-github-release-id-invalid")
        expected = self._artifact_files(plan, candidate)
        assets = self._release_assets(release_id)
        by_name = {item.get("name"): item for item in assets if isinstance(item.get("name"), str)}
        slug = self._repository_slug()
        for name, content in sorted(expected.items()):
            existing = by_name.get(name)
            if isinstance(existing, Mapping):
                asset_id = existing.get("id")
                if not isinstance(asset_id, int) or self._download_asset(asset_id) != content:
                    raise release.ReleaseError(f"publisher-github-asset-conflict:{name}")
                continue
            media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
            url = (
                f"{self.uploads_base.rstrip('/')}/repos/{slug}/releases/{release_id}/assets"
                f"?name={urllib.parse.quote(name, safe='')}"
            )
            status, _response = self._http(
                "POST", url, body=content, content_type=media_type
            )
            if status != 201:
                raise GitHubRequestError(status, "upload-asset")
        return {
            "releaseId": release_id,
            "assetHashes": self._asset_records(release_id, expected),
        }

    def _verify_remote_identity(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        push = self._step_result(candidate, "push-release-source-and-tag")
        branch = push.get("branch")
        tag = push.get("tag")
        commit = push.get("releaseCommit")
        if not all(isinstance(value, str) for value in (branch, tag, commit)):
            raise release.ReleaseError("publisher-push-result-invalid")
        if tag != f"v{self._version(plan)}" or commit != self._release_commit(plan, candidate):
            raise release.ReleaseError("publisher-push-result-invalid")
        local_tag_ref = self._git_text("rev-parse", f"refs/tags/{tag}")
        remote_branch, remote_tag_ref, remote_tag_commit = self._remote_refs(
            str(branch), str(tag)
        )
        if (
            remote_branch != commit
            or remote_tag_ref != local_tag_ref
            or remote_tag_commit != commit
        ):
            raise release.ReleaseError("publisher-remote-ref-verification-failed")
        github_release = self._recorded_owned_release(plan, candidate)
        release_id = github_release["id"]
        assert isinstance(release_id, int)
        expected = self._artifact_files(plan, candidate)
        return {
            "releaseCommit": commit,
            "tag": tag,
            "releaseId": release_id,
            "assetHashes": self._asset_records(release_id, expected),
        }

    def _publish_github_release(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        verified = self._completed_result(self._journal(candidate), "verify-remote-identity")
        release_id = verified.get("releaseId")
        if not isinstance(release_id, int) or isinstance(release_id, bool) or release_id <= 0:
            raise release.ReleaseError("publisher-github-release-id-invalid")
        tag = f"v{self._version(plan)}"
        commit = self._release_commit(plan, candidate)
        if verified.get("tag") != tag or verified.get("releaseCommit") != commit:
            raise release.ReleaseError("publisher-verified-release-identity-conflict")
        current = self._recorded_owned_release(
            plan, candidate, expected_release_id=release_id, allow_published=True
        )
        if current.get("draft") is True:
            slug = self._repository_slug()
            value = self._api_json(
                "PATCH",
                f"/repos/{slug}/releases/{release_id}",
                payload={"draft": False},
            )
            if not isinstance(value, Mapping):
                raise release.ReleaseError("publisher-github-release-response-invalid")
            current = value
        self._assert_recorded_release_identity(
            current,
            plan,
            release_id=release_id,
            commit=commit,
            allowed_draft_states=(False,),
        )
        if current.get("draft") is not False:
            raise release.ReleaseError("publisher-github-release-publish-failed")
        return {
            "releaseId": release_id,
            "releaseUrl": str(current.get("html_url", "")),
            "tag": tag,
            "draft": False,
            "publishedAt": str(current.get("published_at", "")),
        }

    @staticmethod
    def _is_within(path: Path, parent: Path) -> bool:
        try:
            path.relative_to(parent)
            return True
        except ValueError:
            return False

    def _validated_targets(self, candidate: Path) -> list[Path]:
        raw_targets = list(self.generated_copy_targets)
        targets: list[Path] = []
        for raw in raw_targets:
            if not raw.is_absolute():
                raise release.ReleaseError("publisher-generated-target-must-be-absolute")
            target = raw.resolve(strict=False)
            if target in targets:
                raise release.ReleaseError("publisher-generated-target-duplicate")
            for protected in (self.root, candidate.resolve()):
                if self._is_within(target, protected) or self._is_within(protected, target):
                    raise release.ReleaseError("publisher-generated-target-overlaps-release-data")
            if target.exists() and (target.is_symlink() or not target.is_dir()):
                raise release.ReleaseError("publisher-generated-target-invalid")
            targets.append(target)
        for index, target in enumerate(targets):
            for other in targets[index + 1 :]:
                if self._is_within(target, other) or self._is_within(other, target):
                    raise release.ReleaseError("publisher-generated-targets-overlap")
        return targets

    def _load_generated_manifest(self, target: Path) -> dict[str, tuple[int, str]]:
        path = target / GENERATED_COPY_MANIFEST
        if not path.exists():
            return {}
        try:
            value = json.loads(path.read_text("utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            raise release.ReleaseError("publisher-generated-manifest-invalid") from None
        if not isinstance(value, Mapping) or value.get("kind") != GENERATED_COPY_KIND:
            raise release.ReleaseError("publisher-generated-manifest-invalid")
        entries = value.get("managedFiles")
        if not isinstance(entries, list):
            raise release.ReleaseError("publisher-generated-manifest-invalid")
        result: dict[str, tuple[int, str]] = {}
        for entry in entries:
            if not isinstance(entry, Mapping):
                raise release.ReleaseError("publisher-generated-manifest-invalid")
            relative = entry.get("path")
            size = entry.get("size")
            digest = entry.get("sha256")
            if (
                not isinstance(relative, str)
                or not isinstance(size, int)
                or not isinstance(digest, str)
                or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            ):
                raise release.ReleaseError("publisher-generated-manifest-invalid")
            release.validate_relative_path(relative)
            result[relative] = (size, digest)
        return result

    @staticmethod
    def _assert_no_symlink_parent(target: Path, relative: str) -> None:
        current = target
        for part in PurePosixPath(relative).parts:
            current = current / part
            if current.exists() and current.is_symlink():
                raise release.ReleaseError("publisher-generated-target-symlink-conflict")

    def _plan_generated_copy_sync(
        self,
        plan: Mapping[str, object],
        candidate: Path,
        files: Mapping[str, bytes],
    ) -> list[_SyncPlan]:
        del plan
        plans: list[_SyncPlan] = []
        for target in self._validated_targets(candidate):
            previous = self._load_generated_manifest(target) if target.exists() else {}
            for relative, (old_size, old_digest) in previous.items():
                self._assert_no_symlink_parent(target, relative)
                current_path = target.joinpath(*PurePosixPath(relative).parts)
                if not current_path.exists():
                    continue
                if not current_path.is_file():
                    raise release.ReleaseError("publisher-generated-managed-path-invalid")
                current = current_path.read_bytes()
                new = files.get(relative)
                if (
                    (len(current), release.sha256_bytes(current)) != (old_size, old_digest)
                    and current != new
                ):
                    raise release.ReleaseError(
                        f"publisher-generated-managed-file-modified:{relative}"
                    )
            for relative in files:
                self._assert_no_symlink_parent(target, relative)
                destination = target.joinpath(*PurePosixPath(relative).parts)
                if destination.exists() and not destination.is_file():
                    raise release.ReleaseError(
                        f"publisher-generated-candidate-path-conflict:{relative}"
                    )
                if (
                    destination.is_file()
                    and relative not in previous
                    and destination.read_bytes() != files[relative]
                ):
                    raise release.ReleaseError(
                        f"publisher-generated-unmanaged-file-conflict:{relative}"
                    )
            plans.append(
                _SyncPlan(
                    target=target,
                    candidate_files=files,
                    remove=tuple(sorted(set(previous) - set(files))),
                )
            )
        return plans

    @staticmethod
    def _atomic_write(path: Path, content: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
        temporary.write_bytes(content)
        os.replace(temporary, path)

    def _sync_generated_copies(
        self, plan: Mapping[str, object], candidate: Path
    ) -> Mapping[str, object]:
        files = release.collect_staged_files(candidate)
        release.verify_candidate_files(plan, files)
        sync_plans = self._plan_generated_copy_sync(plan, candidate, files)
        commit = self._release_commit(plan, candidate)
        tag = f"v{self._version(plan)}"
        results: list[dict[str, object]] = []
        manifest = {
            "schemaVersion": 1,
            "kind": GENERATED_COPY_KIND,
            "version": self._version(plan),
            "planDigest": self._plan_digest(plan),
            "releaseCommit": commit,
            "tag": tag,
            "managedFiles": release.file_inventory(files),
        }
        manifest_bytes = release.pretty_json_bytes(manifest)
        for item in sync_plans:
            item.target.mkdir(parents=True, exist_ok=True)
            for relative, content in sorted(item.candidate_files.items()):
                destination = item.target.joinpath(*PurePosixPath(relative).parts)
                self._atomic_write(destination, content)
            for relative in item.remove:
                obsolete = item.target.joinpath(*PurePosixPath(relative).parts)
                if obsolete.is_file():
                    obsolete.unlink()
            self._atomic_write(item.target / GENERATED_COPY_MANIFEST, manifest_bytes)
            results.append(
                {
                    "target": str(item.target),
                    "fileCount": len(files),
                    "contentDigest": release.digest_file_map(files),
                    "manifestSha256": release.sha256_bytes(manifest_bytes),
                }
            )
        return {
            "releaseCommit": commit,
            "tag": tag,
            "generatedCopies": results,
        }


__all__ = ["GENERATED_COPY_MANIFEST", "GitHubPublishAdapter"]
