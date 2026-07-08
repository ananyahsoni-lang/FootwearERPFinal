# SSK Footcare ERP — PRD

## Original Problem Statement
Build a comprehensive local/cloud B2B footwear manufacturing ERP. Costing calculation based on raw-material yield, order management against styles, production floor tracking (9 stages) with kanban-style colour×size matrix, PO upload/extraction from PDF/Excel, multi-user/multi-role login, inventory, worker payroll ledger and productivity bonuses.

## User Personas
- Admin / Owner — full system control, settings, users, costing margins
- Manager — POs, production scheduling, payroll, reports
- Production lead — daily floor (kanban, assignments, defects, WhatsApp share)
- Sales — POs, styles, dispatch invoices

## Core Requirements (static)
1. Style master with BOM + yield-based costing + image
2. PO upload from PDF/Excel with auto job creation
3. Production floor with 9 stages, colour×size matrix
4. Inventory with auto-consumption on procurement→cutting
5. Worker (Karigar) master + assignment + ledger + bonus
6. Payroll with advances + payments + ledger reconciliation
7. PDFs: Production Card (with per-process tally), Dispatch Challan, Tax Invoice, Material Requirements, Wage Slip
8. Multi-user RBAC (admin/manager/production/sales)
9. Visual reports (variance, cycle time, defect, monthly, karigar)
10. Time-bound stages with overdue alerts (admin-configurable)
11. WhatsApp share for production cards

## What's been implemented
- 2026-06-25 (forks 1-9): Full ERP base, Auth, PO PDF parsing, Production kanban (color×size), BOM/Yield costing, Style image upload, Components tracking, Karigar assignment + DnD bulk re-assign, Karigar ledger + bonus + wage-slip PDF, Inventory auto-consume + reorder alerts, Dispatch Challan + Tax Invoice + Material Req PDFs.
- 2026-06-26 (this fork — iteration 10):
  • **P0 fix**: Payment recording 400 error in Payroll (`openLedger(ledgerFor.row)`)
  • **Settings/ETA**: `/api/settings/stage-durations` + `/settings` page — admin configures per-stage hours
  • **Time-bound stages**: `stage_entered_at` + `stage_deadline` saved on every transition + initial job creation
  • **Overdue alerts**: `/api/dashboard/overdue` + red banner on Dashboard + red `OVERDUE` strip on Production cards
  • **Visual Reports** (Recharts): Production Trend (line), Karigar Output (bar), Cost Variance (bar), Cycle Time (bar), Defect Analytics (bar + pie)
  • **Production Card PDF**: added `PROCESS TALLY` table — per-process × per-size grid (DONE/REJ/SIGN columns) for floor workers to fill in
  • **WhatsApp Share**: green WhatsApp button on every production card, dialog with karigar phone picker, downloads PDF locally + opens wa.me chat

## Prioritized Backlog
**P0** — none open
**P1** — Bulk pay multiple karigars at end-of-week (deferred per user)
**P2** — Server-side WhatsApp Cloud API for direct PDF upload (no manual drag-drop)
**P2** — Visual seed for testing overdue badge (job with past stage_deadline)
**P3** — Split `server.py` into modules (production / payroll / reports)

## Next Tasks
- (When user asks) Bulk pay multi-karigar payout flow
- (When user asks) WhatsApp Cloud API integration

## Iteration 11 (2026-06-26)
- **FREE PO Extractor**: Replaced LLM-only path with `po_extractor_free.py` using `pdfplumber` + `openpyxl`. Zero recurring cost, no Cloudflare/timeout failures. LLM remains optional fallback if EMERGENT_LLM_KEY is set. Verified working on numeric (SIYARAM 2220008835) and alphabetic (TEST-PO-001) POs.
- **Packing List**: 
  • Default SSK template generator (`packing_list.py`) matching uploaded template format exactly.
  • Custom per-client templates: upload xlsx with `{{placeholders}}` like `{{po_number}}`, `{{client_name}}`, `{{vendor_gstin}}`, `{{lines}}` for the line-item row marker. Header row above `{{lines}}` is auto-detected to map columns.
  • Endpoints: `POST /api/packing-lists/job`, `GET/POST/DELETE /api/packing-templates`.
- **Auto-archive**: Once a job has BOTH `invoice_generated_at` and `packing_generated_at` set, it gets `archived=True`. `GET /api/production/jobs` filters out archived (use `?include_archived=true` to include).
- **Archive UI** (`Production.jsx`): "Archive (N)" toggle button → `ArchivePanel` showing grouped archived cards with style image, PO info, sizes, three actions (View Details / Card PDF / Packing). `DetailModal` shows full size breakdown, karigar assignments, and stage history table.
- **A4 Production Card fix** (`pdf_card.py`): Total width capped at 180mm usable. Company name strip now WHITE on dark background (was black-on-dark = invisible). Tally + size columns scale to fit. Tested with 9 sizes → all columns fit on A4.

### Verified
- iteration_11.json: Backend 7/7, Frontend 4/4 critical flows green. Auto-archive end-to-end (PATCH dispatched → POST invoice → POST packing → archived=True). PDF page size exactly 595x842 pt with 'SSK FOOTCARE MANUFACTURING LLP' string present.

## Iteration 12 (2026-06-26)
- **PDF Extractor fix for SHEIN/NEXTGEN format**: multi-line table cells, comma-split description → desc/color/size, smarter client/vendor detection (top-of-document and Vendor-Code pattern), Total Order Value / TOTALBASICVALUE detection, prefer BaseCost over MRP for unit_price. Verified: 126 line items from 25-page PDF.
- **Packing-list manual fields**: dispatch_date, transporter, vehicle_no, driver_name, driver_phone, site_code, destination, port, notes all captured via a modal and rendered into the xlsx (row 15 + notes block at bottom).
- **Persistence & re-download**: every generated packing list saved (file_b64 in `packing_lists`). `GET /api/packing-lists` lists them, `GET /api/packing-lists/{id}/file` re-downloads the exact original bytes. Archive view shows a "Saved Packing Lists" table.
- **Merged packing list**: `POST /api/packing-lists/merged` produces ONE xlsx for jobs spanning multiple POs of the same client. Optional `sectioned=true` inserts a "PO: <number>" header row per source PO. Cross-client merges 400.
- **Auto-pick template by alias**: `PackingTemplate.aliases: List[str]`. When generating without explicit `template_id`, the system picks the template whose alias is a case-insensitive substring of the PO's client_name. Settings page exposes upload/list/delete UI.
- **UI Polish**: `Card` component now forwards arbitrary props (data-testid, style, etc.) — fixes the LOW-priority pass-through issues flagged in test report.

### Verified (iteration_12.json)
- Backend: 10/10
- Frontend: all 4 critical flows green (Packing modal with 14 fields, Merge-Packing button, Archive view re-download, Templates upload+delete)

## Iteration 13 (2026-06-27) — Accounts Receivable / Tally Ledger
**Complete AR / Receivables system:**
- **Invoice archive**: All generated invoices saved with PDF bytes (`file_b64`) + due_date (default +45d, override from PO payment_terms numeric) + computed totals (subtotal, CGST/SGST/IGST, grand_total). Page `/invoices` with 5 status tiles (Total / Pending / Partial / Overdue / Paid), search, status filters, row actions (view detail, download PDF, record GRN, record payment). Re-download via `/api/invoices/{id}/file`.
- **GRN (Goods Receipts)**: `POST /api/grns` — line-item level capture of dispatched / received / accepted / rejected qty with rejection_reason. Auto-numbered `GRN-2026-NNNN`. Short / rejected pcs auto-reduce the invoice's net amount via `grn_adjustment`.
- **Payments**: `POST /api/payments` — FIFO-allocates a lump-sum across selected invoices by due_date. Modes: Bank Transfer/RTGS/NEFT/Cheque/UPI/Cash/Adjustment. Captures reference (UTR/Cheque#), bank, notes. Over-payments record `advance_amount`. Auto-numbered `RCT-2026-NNNN`.
- **Tally-style Client Ledger**: `GET /api/clients` + `/api/clients/{name}/ledger`. Returns chronological entries with vch_type (Invoice/Payment/GR Adj), Dr/Cr columns, running balance with Dr/Cr suffix, closing balance, aging buckets [0-30, 31-60, 61-90, 90+], totals.
- **Overdue alert**: Dashboard red banner when any invoice past its due_date; Invoices page red tile.
- **Legacy clean-up**: 12 pre-AR invoices flagged `legacy: True` and excluded from listing by default (toggleable via `?include_legacy=true`).

### Verified (iteration_13.json)
- Backend: 19/19 pytest passed
- Frontend: 100% (all critical flows verified: Invoices list, modal, GRN dialog, Payment dialog, Clients list, Tally Ledger modal with aging)

## Iteration 15 (2026-01) — Online Profitability Engine (Phase 4)
**Cost of goods actually sold vs revenue actually received, per period/platform/style.**
- **`GET /api/reports/online-profitability`** — 6-step reconciliation:
  A) Net units sold from `online_order_items.is_net_sold=true` (Phase 2 classification)
  B) Net COGS via existing `compute_style_costing()` — same engine as B2B, one source of truth
  C) Revenue settled = `settlement_forward.settled_amount_*` − `settlement_reverse.settled_amount_*`
  D) Revenue pending = same shape over `settlement_unsettled_forward/reverse`
  E) Platform fees = commission + fixed_fee + logistics_fwd + pick_and_pack + tech_enablement + royalty (forward − reverse). Reported INFORMATIONAL — Myntra already nets them out of Settled_Amount.
  F) Cost-of-returns logistics = reverse-side logistics rows surfaced separately so RTO drag is visible even when inventory is restocked.
- **Per-style breakdown**: units_sold, returned_units, unit_cogs, cogs, revenue_settled, platform_fees, profit, margin_pct, return_rate_pct = returned/(returned+sold)×100. Attribution via `order_release_id → online_order_items.style_id` `$lookup` join (or direct `style_id` on settlement rows when Phase 3 populates it).
- **Sample validation of fee interpretation**: fetches a sample of forward rows, computes `Settled_Amount + Sum(fees) vs Customer_Paid_Amount`, tags the result `fees_already_netted` | `fees_not_netted` | `inconclusive` (±2 % tolerance) and surfaces the raw sums in the response so the ops team can override if the assumption is wrong.
- **Materialised rollup**: `online_profitability_daily` collection, keyed by `(platform, date_from, date_to, style_id)`. Populated by:
  1. `POST /api/reports/online-profitability/rebuild?platform=&date_from=&date_to=` — manual full rebuild (admin/manager).
  2. Auto-hooks on `POST /api/online-orders/monthly-report-import` and `POST /api/online-orders/dispatch-import` (non-dry runs only) — recomputes the affected date range (per-day + aggregate) at end of import. Failures here are logged but never roll back the import.
- **`GET /api/reports/online-profitability-materialised`** — fast dashboard read of the last N snapshots.
- **Graceful degradation** — when Phase 3 settlement collections don't exist yet, revenue/fees/logistics all return 0 and the endpoint falls back to `online_order_items.final_amount` for a best-effort profit line, marking `revenue_source_used` accordingly. Numbers flow the instant Phase 3 lands, zero code change.

### Verified
- Seeded 1 style w/ BOM (unit COGS ₹281.25), 10 net-sold + 2 returned `online_order_items`, 10 fwd + 2 rev settlement rows. Endpoint returns: sold=10, cogs=2812.5, revenue_settled=7200, platform_fees=2500, cost_of_returns_logistics=80, gross_profit=4387.5, gross_margin_pct=60.94%, by_style[0].return_rate_pct=16.67%. `phase_3_available=true`, `revenue_source_used=settlement_forward - settlement_reverse`, sample validation reported.
- Manual rebuild endpoint materialised 3 daily + 1 aggregate snapshot; `online_profitability_daily` unique index prevents duplicates.

## Iteration 17 (2026-01) — Image Upload Pipeline
Rebuilt `POST /api/upload/image` end-to-end using Pillow.
- **Security & validation**: 8 MB server-side cap (HTTP 413), extension allow-list + `PIL.Image.verify()` (rejects spoofed extensions like `.jpg` masquerading over garbage bytes), auto-orient via `ImageOps.exif_transpose` (respects phone-camera EXIF Orientation flags), EXIF stripped from all re-encoded outputs.
- **Three variants generated on every upload**, all re-encoded as JPEG (progressive, `optimize=True`), never upscaling:
  - `original.jpg` — max 1600 px, quality 85
  - `display.jpg` — max 600 px, quality 82
  - `thumbnail.jpg` — max 150 px, quality 80
- **Storage layout**: local → `uploads/images/{uuid}/{original,display,thumb}.jpg`; S3 → `images/{uuid}/{name}` mirror.
- **Response shape**: `{url, original_url, display_url, thumbnail_url, width, height}` — `url` retained as alias for `original_url` so existing callers (`Styles.jsx`) don't break.
- **New helper `resolve_local_upload_path(url) -> str | None`** — maps a local upload URL back to a filesystem path (with path-traversal defence), returns `None` for S3/external/garbage. Enables PDF generators to read files directly, no self-HTTP round-trip.

### Verified
- 6.5 MB EXIF-6 landscape photo → all three variants come out portrait, dims 1143×1600 / 429×600 / 107×150, sizes 266 / 3.5 / 1.0 KB, EXIF stripped on all.
- 9 MB blob → HTTP 413 with "Image too large" detail. Text file renamed `.jpg` → HTTP 400 "not a valid image".
- Resolver test matrix: local URL (both http and https) → path, S3/external URLs → None, `../` traversal → None, non-existent files → None, bare `/uploads/…` → path.

## Iteration 18 (2026-01) — Photo Upload / Display on Materials + Reusable Uploader
- **Backend**: `MaterialIn` gained `image_url`, `image_display_url`, `image_thumbnail_url` (all optional strings) so the three-variant response from `/api/upload/image` is stored directly on the material doc — no recomputation. Same three fields added to `StyleIn` for parity.
- **Reusable `frontend/src/components/ImageUploader.jsx`**:
  - Handles upload UX: client-side size+MIME pre-check (fast feedback), 8 MB cap matching Phase 1's server-side enforcement, in-flight `Uploading…` state with spinner, per-uploader error surface, "Clear Image" button.
  - Accepts either the full `{url, display_url, thumbnail_url}` object OR a legacy plain URL string; emits the full object via `onChange` on success (parents just splat it into their form state).
  - Preview `<img>` prefers `display_url`, falls back to `thumbnail_url`, then to the 👟 "No Image" placeholder — no broken-image icon ever shown.
  - Companion `ImageThumb` component for table rows / BOM lists: 36 px default, lazy-loaded, thumbnail_url first with same fallback chain.
- **Styles.jsx refactored** to use `ImageUploader` — removed the 30-line inline `onImageFile` handler + hand-rolled preview markup (which used the 5 MB client-side check that Phase 1's spec called out as the trivially-bypassed anti-pattern). Style-card image tag now prefers `display_url` with `loading="lazy"` and thumbnail-URL fallback via `onError`.
- **Materials.jsx**:
  - `ImageUploader` mounted as the FIRST field in the drawer (photo-first, matches Styles).
  - New first column in the materials table with 36×36 rounded thumbnails via `ImageThumb`, or 👟 placeholder when no image set — never loads full-size images in table rows.
- **BOM builder** (Styles drawer) now shows a 32×32 material thumbnail next to material_code/name on every BOM row, resolved from the loaded `materials` list — so identifying the right fabric/sole during BOM entry becomes visual.

### Verified
- Uploaded a 400×400 tan JPG → response has all 3 URLs, POST `/api/materials` echoes them back on subsequent GET (confirmed via curl round-trip).
- Materials page screenshot shows the thumbnail in the new first column of the row (MAT_IMG_TEST · tan-coloured square · 36 px).
- New-material drawer screenshot: ImageUploader is the top field, "Material Image (max 8MB)" label, 👟 placeholder, Upload/OR-URL controls.
- Styles new-style drawer screenshot: same ImageUploader component mounts (test IDs `style-image-uploader` + `style-image-upload-label` present) — proves the extraction works without visual regression.

## Iteration 19 (2026-01) — Display Robustness sweep
- **New `SafeImage` component** exported from `ImageUploader.jsx`. Enforces fallback chain `display_url → thumbnail_url → url → 👟 placeholder`, wraps every image in a fixed-`aspect-ratio` container (prevents layout shift while loading), and sets `loading="lazy"` on the `<img>` for grid/list contexts. Deduplicates the fallback chain so a broken URL isn't retried three times.
- **Refactored every bare `<img>` that pointed at `image_url`** to use `SafeImage`:
  - `Styles.jsx` — grid cards (was manual `onError` fallback → cleaner)
  - `Costing.jsx` — style preview panel
  - `Production.jsx` — production card image + archive-view card image
  - `OnlineStylePipeline.jsx` — pipeline kanban card
  - `ReadyStock.jsx` — FG-inventory card header
  - Grep confirms **zero bare `<img>` tags remain in `pages/`** — all image display goes through `SafeImage` or `ImageThumb`.
- **Backend response shapes** updated so consumers of `/api/style-lifecycle/list`, `/api/ready-stock/{style_id}`, and the CSV bulk-preview / bulk-upload endpoints return all three URL fields. For externally-supplied URLs (CSV `image_url` column), the raw URL is mirrored into `image_display_url` + `image_thumbnail_url` (Phase 3 spec — no Pillow re-encode for URLs we don't own; the frontend's fallback chain still finds *something* to render).
- **ReadyStock** grouping propagates all 3 URLs into its `style` object so the card header uses the right variant.

### Verified
- Seeded 3 style rows: real-upload (3 variants), external URL (single URL), guaranteed-broken URLs (all 3 invalid). Screenshot proves each renders correctly — real image shows, external picsum photo shows, broken-URL card degrades gracefully to the 👟 placeholder without any broken-image icon. All three cards have identical aspect ratios — no layout shift.
- Grep `<img\b` under `frontend/src/pages/` returns nothing after refactor. All image display now flows through `SafeImage` / `ImageThumb`.

## Iteration 20 (2026-01) — PDF/Printing image loader (core bug fix)
The reported defect: Production Cards printed "No Image" for every style, because `pdf_card._img_from_dataurl` accepted **only** `data:image/...` URLs and every uploaded photo is stored as a plain HTTPS URL.
- **New shared module `backend/pdf_image.py`** — one implementation, every PDF generator shares it, no more copy-paste drift.
  - `load_image_for_pdf(image_or_style, max_h_mm, max_w_mm) -> reportlab Image | None`
  - Accepts a full style/image dict (`{url, image_url, display_url, image_display_url, thumbnail_url, image_thumbnail_url}` — every key the codebase actually produces) or a bare URL string, so both new-shape and legacy-shape callers work.
  - Fallback chain that also **derives** `.../display.jpg` and `.../thumb.jpg` from a legacy `.../original.jpg` URL, so pre-Phase-1 rows on the new Pillow-generated tree still get the small variant.
  - **Smallest-variant picker**: for print boxes ≤ 20 mm picks `thumbnail` first, otherwise `display` first — a 46 mm Production Card box no longer downloads a 1600 px original.
  - **Three fetch paths**: `data:image/…` (base64 decode), local `/uploads/…` (reads straight off disk via Phase-1's `resolve_local_upload_path` — no self-HTTP round-trip that would deadlock uvicorn), external HTTPS (`requests.get` with 5s timeout).
  - **Never raises** — every failure returns `None` so PDF generation continues with the No-Image placeholder instead of 500-ing on one dead link.
  - **In-process byte cache** (bounded FIFO, 128 entries, `clear_cache()` exported) so generating a batch of Production Cards for the same style hits S3 / disk exactly once.
- **`pdf_card.py`**:
  - `_img_from_dataurl` kept as a thin backward-compat wrapper delegating to `load_image_for_pdf` (any external caller of the old symbol keeps working).
  - Call site at line 84 now passes the whole `style` dict, not just `style.image_url`, so the helper can pick the display variant.
- **Grep of every other PDF generator** (`pdf_docs.py`, `pdf_payroll.py`, `pdf_procurement.py`, `packing_list.py`) confirms **no other generator embeds images today** — no latent copies of the bug. Future generators must import from `pdf_image` (spec).

### Verified
- Unit-level: 7-scenario suite through `load_image_for_pdf()` — local dict, bare local URL, external URL, `None`, unreachable URL, derived display fallback, data-URL — all 7 return the expected `Image` or `None`.
- End-to-end: 4 Production Card PDFs generated:
  1. **local upload** — `embedded_image=True`, 22 KB (uses `display.jpg` — smaller than the pre-fix would have been)
  2. **external URL** (picsum) — `embedded_image=True`, 42 KB
  3. **no image** — `embedded_image=False`, 4.5 KB, No-Image placeholder box drawn
  4. **all-broken URLs** — `embedded_image=False`, 4.5 KB, gracefully fell through to placeholder, no exception thrown
- The core reported bug — "photos never print on Production Cards" — is fixed.

## Iteration 21 (2026-01) — Cross-domain image URL fix + Materials lightbox
Two reported bugs — resolved together because they share the same root data (stale image URLs):

### Bug #1 — "uploaded photos never appear, only placeholder shows"
Root cause: uploads persisted **absolute** URLs baked in with the preview hostname at upload time (`http://old-hostname/uploads/...`). When the preview host rotated / the K8s ingress routed only `/api/*` to backend, those URLs became unreachable from the browser.

Fixes:
- **Mounted `/api/uploads` alongside `/uploads`** so uploads route through the ingress (`/api/*` → backend :8001).
- **Persist RELATIVE URLs** — new uploads store `/api/uploads/images/{uuid}/{variant}.jpg` (no scheme, no host) so they survive any hostname change and always resolve against the current origin.
- **Startup migration** (idempotent) — rewrites legacy `/uploads/...` → `/api/uploads/...` and strips any stale absolute hostnames from `/api/uploads/...` URLs already in `styles` + `materials` collections.
- `resolve_local_upload_path()` updated to accept both `/api/uploads/` and legacy `/uploads/` markers.
- `pdf_image._fetch_bytes()` teaches PDFs to read relative URLs via `resolve_local_upload_path` (no HTTP fetch attempt on relative URLs — was returning None with a warning).

### Bug #2 — "material thumbnails should be clickable to see the actual photo"
- **`ImageThumb` gained a `clickable` prop**. When true: thumbnail becomes zoom-in cursor, click opens a full-screen lightbox modal (backdrop dismissal, `X` button top-right, ESC key close), displays the `display_url` variant (600 px — perfect for on-screen preview, not the 1600 px original) with the material's `code — name` in the caption footer, and error-falls-through if that variant fails.
- Applied to: **Materials.jsx** table thumbnails, **Styles.jsx** BOM-row thumbnails (identifying the right fabric during BOM entry).

### Verified
- Screenshot: Materials table now shows the real tan-sandal thumbnail in the row for material `45r` (was placeholder). Clicking it opens the lightbox modal at full size with the sandal photo, caption "45r — gdfg", close button, ESC/backdrop dismissal all working.
- DB check: legacy row `ZFLWWWFLTM71` migrated from `http://footwear-ops.cluster-12.preview.emergentcf.cloud/api/uploads/...` → relative `/api/uploads/...`.
- Ingress test: `/api/uploads/images/{uuid}/display.jpg` returns HTTP 200 with the image bytes; the legacy `/uploads/...` path also still works for direct-hit compatibility.






## Iteration 16 (2026-01) — Visual Insights Report (Profitability UI)
- New page **`/online-profitability`** (`OnlineProfitability.jsx`) mounted in the "Online Commerce" nav group.
  - Filters: platform / date_from / date_to / style / bucket (day|week), Apply button.
  - **7 headline stat tiles**: Net Units Sold, Total COGS, Revenue Settled, Gross Profit, Gross Margin %, Return/RTO Rate %, Return Logistics Cost.
  - Separate blue **"Revenue Pending — NOT YET RECEIVED"** callout so pending settlement never gets mistaken for realised profit.
  - **Fees interpretation panel** — surfaces the sample validation of Settled + Fees vs Customer_Paid_Amount so ops can verify Myntra's netting assumption.
  - **3 Recharts** matching Reports.jsx conventions:
    1. Line chart — daily/weekly trend of Packed vs Returned vs Net Sold (RTO drag over time).
    2. Bar chart — Revenue vs COGS vs Profit per bucket.
    3. Stacked bar — Fee creep (commission / fixed / logistics fwd / logistics rev / pick&pack / tech / royalty).
  - **Liquidation Candidates table** — by_style sorted by `profit` ascending, with `LOSS` badge on negative-profit rows and red-highlighted return_rate ≥ 20% cells. Directly feeds Phase 9 liquidation triage.
  - **Download Report** button → downloads xlsx via new `GET /api/reports/online-profitability/export` (3 sheets: Summary, By Style, Notes).
  - **Rebuild Rollup** button → `POST /api/reports/online-profitability/rebuild` for on-demand cache refresh.
- New backend endpoints:
  - `GET /api/reports/online-profitability/trend?platform&date_from&date_to&bucket=day|week&style_id` — per-bucket rows for the trend/revenue/fee charts.
  - `GET /api/reports/online-profitability/export?...` — StreamingResponse xlsx with Summary + By Style + Notes sheets.
- Nav cleanup — removed 6 orphaned/broken sidebar entries (`/grns`, `/payments`, `/dispatch`, `/returns`, `/settlements`, `/liquidation`) that had no corresponding routes, and surfaced Costing/Defects/Reports (existing routes) in the B2B group.

### Verified
- Screenshot: page renders with 7 stat cards, pending callout, sample-validation panel, trend line chart, revenue bar chart, stacked fee chart, worst-first by-style table with the LOSS badge behaviour, notes panel.
- Export .xlsx confirmed valid: sheets `['Summary','By Style','Notes']`, data row: `['SSK_PROFIT_TEST','Tan',10,2,281.25,2812.5,7200,2500,4387.5,60.94,16.67,'settlement_forward']`.
- Nav shows new "Profitability" entry under Online Commerce; broken entries removed.



## Iteration 14 (2026-02) — Siyaram PO extraction
**P0 fix: Multi-page Siyaram PO extraction**
- `_siyaram_text_block_parse` walks the entire text stream of multi-page Siyaram POs (where the table header row appears only on page 1 and page 3 has no extractable table at all).
- For each numeric data row (`<sr> <qty> PCS <rate> <disc> <cgst> <%> <%> <amount>`), the parser scans neighbouring lines (bounded by the previous/next numeric row) for:
  - Description (`STYLE COLOR SIZE`) — prefer backward search to avoid stealing the next item's description.
  - Material code chunks (e.g. `5ZEZP125WW` + `FLT11719888` → `5ZEZP125WWFLT11719888`).
  - HSN code (defaults to footwear `64029990`).
  - Handles the page-break variant where material + description share a single line (e.g. `FLTM7128455 ZFLWWWFLTM71 TAN 5`).
- `_looks_like_siyaram(text)` heuristic dispatches to this parser before the legacy table parser.
- `_split_color_size_from_desc` extended to accept space-separated descriptions (`STYLECODE COLOR SIZE`) in addition to the existing SHEIN comma-separated format.
- `_HEADER_TOKENS` reordered + new `"material"` alias and `"total net value"` alias.
- `_parse_meta` vendor-name detection rewritten: prefers the line right after `Vendor Name & Address:` and requires a corporate suffix (LLP / LTD / LIMITED / PVT / INC / CORP / LLC) so address fragments like `GARDEN MUMBAI MUMBAI 400071 MAHARASHTRA` no longer match.
- `_finalise_totals` recognises Siyaram's `NET TOTAL` footer line to capture the grand total.

### Verified (iteration_14)
- Backend pytest: **68 passed, 4 skipped** (no regressions; all iteration 10/11/12/13 suites green).
- New regression suite `test_iteration14_siyaram.py` (17 tests) pins the expected 32 line items / 2088 qty / ₹333,440 grand total for the supplied PO `2220008835`.
- End-to-end POST `/api/pos/extract` via httpx returns 32 line items with full style_code, description, color, size, qty, rate, amount.
