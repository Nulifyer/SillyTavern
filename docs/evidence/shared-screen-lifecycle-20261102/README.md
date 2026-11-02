# Shared screen lifecycle follow-up

The user reported that Image generation settings still disappear and requested
all screens be checked as a core issue. They later confirmed their affected
page is **v1.19.8**. This project thread had published v1.19.9 but had not updated
production or shared test85.

## Results

- On isolated v1.19.8 at localhost:8012, Writing & replies > Presets hides the
  mounted native panel. Its classes become
  `drawer-content fillLeft workspace-mounted-panel closedDrawer`. The exact
  assertion and screenshot are in v1.19.8-reproduction.log and
  v1.19.8-hidden-panel.png. This is the shared auto-close ownership failure
  already repaired in v1.19.9, not a missing image-provider connection.
- The original v1.19.9 application source excludes mounted panels from native
  outside-click and drawer-switch closing. WorkspaceSettings owns their lifetime.
  Source commit: `9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1`.
- On the actual published v1.19.9 image at localhost:8014, the complete controlled
  browser suite passed **27 cases in 2.8 minutes**. The 2 opt-in live-service
  cases were skipped. No inference implementation changed; original live
  acceptance remains in ../ui-juiced-20261102/.
- The new regression changes native controls across 11 categories at
  1280/390/320px, uses direct category-rail navigation, and holds a settings save
  until after navigation to Image generation. All **33 checkpoints** retain
  the same mounted native panel. settings-changes.json records each checkpoint
  and zero page errors in that case. The final targeted run also explicitly
  awaited the held save response before checking the image panel and passed in
  11.1 seconds, recorded in delayed-save.log. Three changed-image-settings PNGs show
  image controls after source/model/sampler/scheduler/size changes.
- Existing cases also exercise the character editor, all settings sections,
  keyboard, dialogs, source failure/retry, stale discovery, stories, profiles,
  archive, pending generation, dictation failure/cancellation, mobile layouts,
  larger text, reload and classic restoration. The three categories JPGs show
  all 12 settings categories at 1280/390/320px. All were visually inspected.
- Manual T3 browser checks on 8014 also covered image source/model changes,
  refresh, automatic tools, image/voice category switching and cancelling the
  native Save style dialog with Escape. No disappearance was observed there.
- Root lint and continuity validation passed. Unit tests were not rerun because
  only tests, documentation and evidence changed.

The first old-container run reached the port before startup completed and
failed with `net::ERR_SOCKET_NOT_CONNECTED`. v1.19.8-startup-race.log retains
that harness failure. The reproduction run followed a successful HTTP readiness
check and failed on the hidden mounted panel, not startup. The baseline
container was stopped after the comparison.

## Handoff and limits

No new application patch, tag or image was produced. The user needs the already
published v1.19.9 fix. container.json confirms the tested immutable index and
five synthetic volumes without overlays. Exact architecture digests, workflow,
backup and rollback requirements are in ../../container-releases.md.

Homelab owns deployment. Production69 and shared test85 were never read,
browsed, mounted or changed. Preserve all production volume identities.
The user's exact image-control trigger remains unknown; the reproduced shared
failure and their version establish why the published fix has not reached them.
Any remaining failure after deployment still needs investigation.
