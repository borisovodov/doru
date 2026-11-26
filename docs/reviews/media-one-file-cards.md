# Review: one media card per file

- Branch: `media/one-file-cards`
- Base: `origin/main` (`e0dc4b73`)
- Reviewed commit: `345558e4`
- Date: 2026-11-26

The review covered the one-file media model, GEDCOM/GEDZIP import and
export, remote media downloads, core persistence, desktop IPC and the media
UI. The findings below were fixed in the same branch after the review.

## Findings

### 1. Medium — Project-write failures were treated as download failures

**Where:** `apps/desktop/src/main/gedcom.ts`, `prepareGedcomMedia`.

`storeRemote` wrapped both `downloadRemoteMedia` and the project write in one
`try` block. A failed `fs.writeBinary` — full disk, read-only project folder,
missing permissions — was caught as a failed download, logged as a warning,
and the URL stayed in the tree as an external reference.

**Scenario:** the project folder becomes read-only during import. Every remote
media file fails to save, the import finishes successfully, and the user gets
external placeholders instead of local files. This contradicted the local-file
branch, where project-write failures intentionally abort the import.

**Fix:** only the download call is caught now. The project write runs after the
`try` block, so write failures propagate and the import fails with the normal
error dialog. A unit test injects a failing write and asserts the error
propagates.

### 2. Medium — The total remote size limit was not hard under concurrency

**Where:** `apps/desktop/src/main/gedcom.ts`, `prepareGedcomMedia`.

The remaining budget was derived from `remoteBytes`, which was updated only
after a download completed. With four concurrent workers, all four could read
the same remaining budget and start downloads that together exceeded the
500 MB limit.

**Scenario:** eight 100 MB URLs with the default limits. The first four
downloads use 400 MB, then each worker still observes roughly 100 MB of
remaining budget and starts another 100 MB download, so the import can
download up to 800 MB.

**Fix:** the importer now reserves budget before starting a download
(`reservedBytes`) and releases the reservation in `finally`. The sum of
completed bytes plus in-flight reservations can never exceed the limit. The
import also stops starting downloads after 1000 URLs or after 10 minutes of
remote work, and each file keeps its own 30-second timeout.

### 3. Security — Private-address validation was vulnerable to DNS rebinding

**Where:** `apps/desktop/src/main/mediaDownload.ts`, `downloadRemoteMedia`.

The hostname was resolved and checked with `dns.lookup`, then a separate
`fetch` resolved the same hostname again. A malicious GEDCOM could return a
public address during validation and a loopback, link-local or intranet
address during the actual request.

**Scenario:** an imported GEDCOM references `https://attacker.example/photo`.
The attacker's DNS returns a public IP for the validation lookup, then
`127.0.0.1` or `169.254.169.254` for the fetch. The private-address check
would pass while the app requests a local service.

**Fix:** downloads through the built-in fetch path now use an undici `Agent`
whose `lookup` returns only the addresses that were just resolved and verified
as public. The connection is pinned to those addresses while the `Host`
header and TLS SNI stay tied to the original hostname. Every redirect is
resolved and checked again before it is followed. The injectable fetch seam
used by unit tests bypasses pinning by design.

### 4. Low — Media badge counts disagreed between the tree and the person editor

**Where:** `packages/core/src/service/tree.ts`, `personCounts`.

`PersonEditor` counted media with `isVisibleMedia`, which includes external
URLs, while `personCounts` used `isProjectMediaPath`, which excludes them.

**Scenario:** a person has only an external media card. The person editor shows
one media item, while the badge on the tree card shows zero.

**Fix:** `personCounts` now uses the same `isVisibleMedia` predicate. The
service test covers a project file, a hidden `..` path and an external URL.

### 5. Low — No integration test for the media preparation step

**Where:** `apps/desktop/tests/media-download.test.ts`,
`apps/desktop/src/main/gedcom.ts`.

The existing tests covered `downloadRemoteMedia` in isolation but not the
`prepareGedcomMedia` flow, which is where downloads are written into `media/`
and mapped back to GEDCOM `FILE` payloads.

**Fix:** `prepareGedcomMedia` exposes injectable download, write and logger
seams. The new `apps/desktop/tests/gedcom-media.test.ts` covers the successful
download and mapping, the failure that keeps the URL as an external reference,
and the project-write failure that must propagate.

## Pull request review follow-up

The CodeRabbit review on PR #235 added these findings. All actionable comments
were fixed:

- Import workers now stop taking new items after the first project-write
  failure and drain the active downloads before the error propagates, so the
  temporary project is not deleted under a running worker.
- Download failures are logged as a sanitized category; the raw error is never
  written because undici can include the full URL, including credentials, in
  its message.
- The per-file deadline now covers DNS resolution as well as the fetch and
  response body.
- A GEDZIP import copies only bundled entries; an unmatched local `FILE` path
  is left as an external reference instead of copying a same-named file from
  beside the archive.
- The zh-tw tree page uses the established 儲存庫 and 任務 terms.
- The schema document no longer lists contacts as a media target.
- A successful media save uses the submitted values as its reconciliation
  baseline, so a later reversal is still saved.
- Export reserves every retained xref before generating xrefs for split media
  cards, preventing duplicate identifiers.
- The multi-file import test now asserts citation ownership per person.

Two review concerns were kept as deliberate product decisions: remote media is
downloaded silently at import, and the schema bump intentionally rejects files
written by older versions before 1.0.
