# SSK Footcare ERP — PRD (superset of upstream)

## Iteration 22 (2026-07-08) — Opt-in Online Pipeline + PO SKU Mapping + Print-friendly Picklist/Pending
### Bug/Enhancement requests from user
1. **Styles auto-appearing in Online Pipeline** — must be opt-in per style.
2. **PO upload auto-creating styles** — must instead show a mandatory SKU-mapping dropdown.
5. **Picklist print** — replace location QR with product image; group by style/color; use size × qty matrix like the Production Card.
6. **Pending Product List** — make print-friendly with same picklist-style layout (image + matrix, not line items).
7. **Verify online-order → picklist / pending list flow still works.**

### Changes shipped
- `GET /api/styles` now returns `in_online_pipeline: bool` (single joined query on `style_lifecycle`).
- **Styles.jsx**: new globe-icon button + blue "Online" badge on each card; clicking prompts confirm and calls `POST/DELETE /api/styles/{id}/pipeline`.
- **OnlineStylePipeline.jsx**: fixed broken `AddStyleToPipelineDrawer` (was referenced but never defined); implemented picker using `/api/styles/not-in-pipeline`; corrected the misleading empty-state text.
- **POs.jsx** drawer: added mandatory **SSK Style dropdown** next to a new **External SKU** column; extract now pre-resolves via `/api/sku-map/resolve` so previously-mapped clients auto-fill. Save is blocked until every line has a valid SSK style. New mappings are persisted to `/api/sku-map` before the PO POST (409 ignored). `POLineItem` gained optional `external_sku`.
- **Picklist (`GET /api/picklists/{pid}`)**: now enriches every item with `image_url / image_display_url / image_thumbnail_url / style_name`.
- **Picklists.jsx**: on-screen list swaps the location QR for a real product image thumbnail; print view rebuilt as **style + color grouped size matrix** (image on the left, size × qty tally to match the Production Card).
- **Pending list (`GET /api/production/pending-list`)**: same enrichment as picklist.
- **PendingProductList.jsx**: fully rewritten as a print-first component — Style + Color rows with product image + size × qty matrix; shortage rows bubble to top with a red border; "Made" tick-box row for the floor.

### Verified
- `/api/styles` returns `in_online_pipeline` correctly; POST/DELETE `/styles/{id}/pipeline` toggle it and update the returned flag.
- PO create with `external_sku` accepted; `/sku-map` upserted (SSK_00001 ↔ ACME-XYZ-01 for "Acme Corp"); `/sku-map/resolve` returned `matched: true via sku_map`.
- Seeded test online-channel job + picklist. Picklist detail shows the tan-sandal thumbnail per row; pending-list matrix renders per style+color with size columns. Print media emulation confirms clean paper layout.

## Setup
- Auth: JWT (12h access), admin seeded from `backend/.env`.
- Default admin: `admin@ssk.com` / `admin1234`.

## Next Action Items
- If you want SKU mapping to also enforce color/size translation (like the SkuMap page's `color_map` / `size_map`), we can extend the PO drawer with per-line color/size mapping rows too.
- Consider auto-adding a "Print" quick-action from the picklist row (currently only via the detail drawer).

## Iteration 23 (2026-07-08) — Component checkbox bug fix + Password reset flow
### Bug 1 — Production Card "component" checkbox threw HTTP 500
- Root cause: `class ComponentUpdate` was **defined twice** in `server.py` (lines 551 and 890). Python's later definition (component-master fields) shadowed the earlier one (upper/bottom/sole toggles), so the endpoint at line 10041 was validating the wrong schema. The `for k in ("upper_done", ...): getattr(payload, k)` loop then dereferenced attributes the payload no longer had.
- Fix: renamed the master-record model to `ComponentMasterUpdate` and updated the `/components/{cid}` PUT endpoint. Component toggle now returns HTTP 200 with the correct `components` dict.

### Bug 2 (replaced by user with narrower scope) — Admin-driven password reset + admin self-service email reset
- **Admin resets any user's password directly** — new key-icon action on the Users list opens a drawer with new/confirm inputs, PATCHes `/api/users/{uid}` with `password`.
- **Admin self-service reset via email** — new `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`; single-use SHA-256-hashed 32-byte token stored in `password_resets`; 1-hour expiry; TTL index auto-purges expired rows; previous outstanding tokens invalidated when a new one is issued and when a token is redeemed; response never leaks whether the email exists (user-enumeration hardened).
- **Gmail SMTP** delivery via stdlib `smtplib.SMTP_SSL('smtp.gmail.com', 465)` — pulls `GMAIL_USER` + `GMAIL_APP_PASSWORD` from `backend/.env`. Graceful degradation: when creds are missing, the JSON response includes `email_status=email_not_configured` + `dev_reset_url` so the admin can hand-deliver the link during setup. When Gmail is configured properly, no reset URL is ever included in the response.
- **Frontend**: "Forgot password?" link on Login opens a modal; modal shows the SMTP-not-configured hint + clickable dev-reset link when applicable. New `/reset-password?token=...` route with a matching two-field new-password form. Users page gained a key-icon row action opening the admin-reset drawer.
- Fixed the previously-outdated "SEEDED ADMIN (DEV)" hint on Login to show the actual `admin@ssk.com / admin1234` credentials from `.env`.

### Verified
- Component toggle: `PATCH /api/production/jobs/{jid}/components {upper_done:true}` → HTTP 200 with updated `components` object.
- Forgot-password (known email, SMTP off): returns `email_status=email_not_configured` + `dev_reset_url`.
- Forgot-password (unknown email): returns generic OK — no leak, no dev link.
- Reset flow: token from dev link accepts new password, login succeeds with the new password, second use of the same token → HTTP 400 "already used".
- Password restored via a new forgot round-trip so admin creds match `.env` again.

## Iteration 24 (2026-07-08) — Share-link image URLs auto-resolve
### Problem
- Pasting a Dropbox share URL (`https://www.dropbox.com/scl/fi/…?dl=0`) into the Style image field showed a broken image. Same for OneDrive + Google Drive shares.

### Fix
- New `normalize_image_url()` helper in **both** frontend (`ImageUploader.jsx#pasteUrl`) and backend (`server.py`) — mirrored transforms:
  - Dropbox `www.dropbox.com/{s,scl/fi}/…?dl=0` → `dl.dropboxusercontent.com/…` (dl param stripped).
  - OneDrive `1drv.ms/…` or `*.onedrive.live.com/…` → `api.onedrive.com/v1.0/shares/u!<b64url>/root/content`.
  - Google Drive `/file/d/<id>/view` or `?id=<id>` → `drive.google.com/uc?export=view&id=<id>`.
- Applied to `POST/PATCH /api/styles`, `POST /api/styles/bulk/preview`, and `POST /api/styles/bulk` so both interactive edits and Excel bulk imports get the same treatment.

### Verified
- User-provided Dropbox link resolved: image renders on the SSK_00001 card in Styles page. Underlying `dl.dropboxusercontent.com` URL returns a 322KB JPEG (verified via curl + magic-byte check `ff d8 ff …`).
- Unit tests for all four rules pass (dropbox `/s/`, dropbox `/scl/fi/`, onedrive shortlink, onedrive full, gdrive `/file/d/`, gdrive `?id=`, already-normalized passthrough, plain URL passthrough, empty).

## Iteration 25 (2026-07-08) — Demo data seeder for Online Orders / Picklists / Pending List
### New: `python -m seed_demo` (in `/app/backend`)
Idempotent standalone script that populates a realistic online-commerce dataset without touching production code paths. Every row carries `demo_tag="demo:online-seed"` so the seeder can also reset just its own rows via `--reset` without affecting real data.

Seeds:
- 11 `fg_location_inventory` rows (3 styles × Tan/Brown/Black/Beige × sizes 6-10 @ 10 pairs each) across the first 3 warehouse locations.
- 6 `production_jobs` with `source_type="online_channel"` spread across `myntra`, `amazon`, `ajio` channels and stages `procurement` / `cutting` / `stitching` / `packing`. Total: 55 pairs pending.
- 4 top-level `online_orders` with denormalized items into `online_order_items` (mirrors the runtime import-configured shape).
- 3 `picklists` in different states (Pending × 2, In Progress × 1) with real rack/row/col from `warehouse_locations`.

### Verified
- `/api/online-orders` returns 6 online production jobs across 3 channels with correct stages.
- `/api/production/pending-list` returns 6 pending jobs, each enriched with `image_display_url` + `style_name`, all "READY" (no BOM mapped → true by design; when BOMs exist the shortage banner will kick in).
- `/api/picklists` returns 3 demo picklists; opening `PL-DEMO-0001` shows the product image thumb per row, location code, rack/row/col.

### Usage
```bash
cd /app/backend
python -m seed_demo             # seed (idempotent — safe to re-run)
python -m seed_demo --reset     # wipe demo-tagged rows + reseed
```

## Iteration 26 (2026-07-08) — Warehouse rebuild + Clickable Pending List + Production floor for Online (BOM-driven component deduction)
### Warehouse layout overhaul (choice 1a + 2b)
- Constants updated: **RACKS=[A,B,C], ROWS_PER=10 (lines), COLS_PER=8 (cells), CAPACITY=40 pairs** → total **240 cells / 9,600 pair capacity**.
- Naming: `{line:02d}-{rack}-{cell:02d}` → `01-A-01` … `10-C-08`.
- New admin endpoint `POST /api/warehouse/rebuild-layout` — DESTRUCTIVE. Drops all `warehouse_locations`, re-seeds the 240 cells, and MIGRATES existing `fg_location_inventory` into the new layout, preferring cells already assigned to a style (so per-style stock stays clustered — matches the "already allotted rack" rule). Returns a migration report (dropped/inserted/migrated counts).
- Verified: dropped 560 old cells → inserted 240 new @ 40 cap; 17 fg_location_inventory rows migrated to 3 style-home cells; 9,600 pair capacity total.

### Clickable "Made" cell on Pending Product List (choice 3 — my call)
- Each cell in the size × qty matrix is now a button → opens **ProduceCellDrawer** with a big stepper, "Produced all" preset, and a "Deduct from Component Inventory" toggle.
- Backend: `POST /api/production/produce-cell` accepts `{style_id, color, size, produced_qty, reason?, use_components, channel_filter?}` and handles three cases:
  - **produced == pending** → mark matching jobs `dispatched`.
  - **produced <  pending** → dispatch the covered portion, keep the shortfall on the pending list, insert a `short_production_log` row (reason mandatory).
  - **produced >  pending** → dispatch all matching + excess auto-added to `fg_stock` via `_apply_movement` AND placed in the style's already-allotted `fg_location_inventory` cell (or first empty main cell if the style has no cluster yet). Warehouse counters updated in the same transaction.
- Component deduction: when `use_components=true` AND a BOM exists (`style_component_mapping`), each component is deducted from `component_master.current_stock` with `pairs × qty_per_pair × (1 + wastage%)`. Deduction logged in `component_master.history`.
- **If style has no BOM** → endpoint returns HTTP **412 with `code: no_production_card`**; frontend shows a `NoProductionCardPrompt` sub-drawer where the operator picks components from a dropdown (populated from `/api/components`), sets qty-per-pair + wastage%, and saves via `POST /api/production/production-card`. System remembers the mapping — auto-deducts on every future production for that style.
- New endpoint `GET /api/production/short-log` returns the historical short-production audit trail.
- Frontend: `PendingProductList` now filters out fully-produced groups automatically and reflects `quantity - completed_qty` per cell, so the matrix stays accurate after each produce cycle.

### Reuse of B2B production floor (choice 4a)
- No new "online production" page. The pending list itself IS the online production floor now — cells are actionable, no PO required (unlike B2B where PO drives production).
- Optional `channel_filter=online_channel` on produce-cell restricts consumption to online jobs only, so B2B and online can coexist without accidental cross-consumption.

### Verified end-to-end
- Brown/Size 9 (pending 6, produced 6) → dispatched, 6 UPP-TAN-01 components deducted (100 → 94, then 87 → 76 across produce runs).
- Tan/Size 7 (pending 8, produced 12) → dispatched, 4 excess auto-placed at `01-A-01` (SSK_00001's home cell).
- Tan/Size 8 (pending 12, produced 5) → short-log row inserted with reason "Sole vendor supply delayed", 7 pairs remain on pending list.
- Pending list group count dropped from 5 → 4 after Brown/9 fully dispatched.

## Iteration 27 (2026-07-08) — Dedicated Online Production Floor + Full BOM editor
### What changed
- **New page**: `Online Production Floor` (`/online-production-floor`) — sits under the **Online Commerce** sidebar. Ad-hoc / on-demand production with no PO gate. Lists every style opted-in to the Online Pipeline as a card with product image, online status badge, and either a "1 components" or "No BOM" state chip.
- **Every style card exposes two actions**:
  - `Create/Edit Production Card` → opens `BomEditorDrawer` (shared component).
  - `Produce` → opens `AdHocProduceDrawer` — pick color/size/qty → posts to the existing `/production/produce-cell` endpoint. Any pending online jobs are consumed first; the rest lands in the style's home rack as excess (same logic as Pending List). Zero code duplication.
- **BOM edit UI on Styles page** — every style card in the Styles master gained a wrench-icon button (`data-testid="bom-edit-{code}"`) that opens the same `BomEditorDrawer`. This is the "revise/deactivate individual components later" feature the user asked for.
- **`BomEditorDrawer`** (`/frontend/src/components/BomEditorDrawer.jsx`): inline-editable table of BOM rows with:
  - Per-row `Qty/pair`, `Waste %` inputs (dirty-state tracked; save icon appears on edit).
  - Active/Inactive toggle (deactivate temporarily instead of deleting to preserve history).
  - Delete (with confirm) via `DELETE /style-component-mapping/{mid}`.
  - Add-new row at the bottom with a smart component picker (hides components already mapped to avoid duplicate key errors).
- Sidebar entry + route registered in `AppShell.jsx` + `App.js`.

### Verified
- Two demo styles seeded into the pipeline (SSK_00001 · live · 1 component; SSK_00004 · draft · No BOM).
- Screenshots confirm floor renders correctly with product images and state-appropriate buttons.
- BOM drawer opens for SSK_00001, shows its UPP-TAN-01 mapping with editable qty/waste/active toggle + add-new row.
- Zero backend changes needed — reuses `/style-component-mapping` (already had list/create/update/delete) and `/production/produce-cell` (already had all four modes).
