# ui-builder-xtn maintenance

- For an authorized formal release, update main, a new immutable version tag, the GitHub Latest Release with the complete Skill ZIP/checksums, and GitHub Pages together. They must identify the same commit. A main-only or preview-only update is not a completed release.
- Preserve historical tags and Release attachments. Latest-download links should use `/releases/latest`; an explicitly selected old version stays historical.
- Follow `references/release-process.md`. Use the current-main maintenance path for an ordinary release; do not fabricate evidence or restart the historical M8 RC/full-test workflow for metadata-only publication changes.
- Reuse passing evidence under its actual source identity. Run only affected, bounded checks; verify public download bytes and installation from the actual public ZIP before reporting release completion.
