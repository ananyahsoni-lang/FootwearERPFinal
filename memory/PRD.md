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
