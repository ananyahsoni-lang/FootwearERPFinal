import { useEffect, useMemo, useState, useCallback } from "react";
import { http, friendlyAxiosError } from "../lib/api";
import { PageHeader, Card, BtnPrimary, BtnSecondary, Badge } from "../components/ui-kit";
import { SafeImage } from "../components/ImageUploader";
import BomEditorDrawer from "../components/BomEditorDrawer";
import { RefreshCw, Wrench, Hammer, Package, Loader2, X, Info } from "lucide-react";

/**
 * OnlineProductionFloor
 *
 * A dedicated production floor for Online Commerce. Unlike B2B where a PO
 * drives production, online production is triggered on-demand:
 *   1. Operator picks a style from the pipeline.
 *   2. Sets a color + size + quantity.
 *   3. Optionally deducts components (BOM must exist; can be created / edited
 *      right on this page via the same BomEditorDrawer).
 *   4. Produced pairs land directly in FG stock in the style's home cell
 *      (via /production/produce-cell — pending list gets consumed first if any,
 *       any excess goes straight to stock).
 *
 * Reuses the B2B production infrastructure (production_jobs + fg_stock +
 * component_master) — this page is just a focused entry point for online.
 */
export default function OnlineProductionFloor() {
  const [pipelineStyles, setPipelineStyles] = useState([]);
  const [bomCounts, setBomCounts]           = useState({}); // style_id → active BOM row count
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState("");

  const [bomStyle, setBomStyle]     = useState(null);   // opens BomEditorDrawer
  const [produceStyle, setProduceStyle] = useState(null); // opens AdHocProduceDrawer

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      // Same source as OnlineStylePipeline board — returns styles opted-in for online.
      // Response already carries style_code/style_name/image_url so we don't need
      // a separate /styles enrichment round-trip.
      const r = await http.get("/styles/online");
      const cards = r.data || [];
      const merged = cards
        .map((c) => ({
          id:                   c.style_id,
          code:                 c.style_code || "—",
          name:                 c.style_name || "",
          image_url:            c.image_url,
          image_display_url:    c.image_display_url,
          image_thumbnail_url:  c.image_thumbnail_url,
          online_status:        c.online_status,
        }))
        .filter((s) => !!s.id);
      setPipelineStyles(merged);

      // Cheap parallel BOM count lookup so cards can show "3 components mapped"
      // (this scales fine for a curated pipeline — usually <100 styles).
      const counts = {};
      await Promise.all(merged.map(async (s) => {
        try {
          const b = await http.get(`/style-component-mapping?style_id=${s.id}`);
          counts[s.id] = (b.data || []).filter((r) => r.active !== false).length;
        } catch {
          counts[s.id] = 0;
        }
      }));
      setBomCounts(counts);
    } catch (e) {
      setErr(friendlyAxiosError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => ({
    total_styles:       pipelineStyles.length,
    styles_with_bom:    pipelineStyles.filter((s) => (bomCounts[s.id] || 0) > 0).length,
    styles_without_bom: pipelineStyles.filter((s) => !(bomCounts[s.id] || 0)).length,
  }), [pipelineStyles, bomCounts]);

  return (
    <div data-testid="page-online-production-floor">
      <PageHeader
        title="Online Production Floor"
        subtitle="Produce on demand · no PO required · shares components + racks with the B2B floor"
        testId="op-floor-header"
        action={
          <BtnSecondary onClick={load} disabled={loading} data-testid="op-refresh">
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </BtnSecondary>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm">{err}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Pipeline styles</div>
            <div className="text-3xl font-black mt-1">{summary.total_styles}</div>
            <div className="text-xs text-slate-500">available to produce</div>
          </Card>
          <Card className="p-4 border-emerald-300">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Ready (BOM mapped)</div>
            <div className="text-3xl font-black mt-1 text-emerald-800">{summary.styles_with_bom}</div>
            <div className="text-xs text-slate-500">deducts components automatically</div>
          </Card>
          <Card className="p-4 border-amber-300">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Need production card</div>
            <div className="text-3xl font-black mt-1 text-amber-800">{summary.styles_without_bom}</div>
            <div className="text-xs text-slate-500">map components first</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Floor mode</div>
            <div className="text-lg font-black mt-1">Ad-hoc / On-demand</div>
            <div className="text-xs text-slate-500">no PO gate</div>
          </Card>
        </div>

        <div className="p-3 bg-slate-50 border-2 border-slate-200 text-xs text-slate-700 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-500" />
          <div>
            Only styles you&apos;ve <strong>opted into the Online Pipeline</strong> appear here. Add or remove them from
            the <em>Styles</em> master (globe icon on a style card) or the <em>Online Style Pipeline</em> board.
          </div>
        </div>

        {loading ? (
          <Card className="p-10 text-center text-slate-400">Loading…</Card>
        ) : pipelineStyles.length === 0 ? (
          <Card className="p-10 text-center text-slate-500">
            No styles in the online pipeline yet. Opt-in a style from the <em>Styles</em> master to see it here.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelineStyles.map((s) => {
              const cnt = bomCounts[s.id] || 0;
              return (
                <Card key={s.id} className="p-0 overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="w-24 flex-shrink-0 bg-slate-50 border-r border-slate-200">
                      <SafeImage
                        image={{
                          url: s.image_url,
                          display_url: s.image_display_url,
                          thumbnail_url: s.image_thumbnail_url,
                        }}
                        alt={s.code}
                        aspectRatio="1/1"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                      <div className="font-mono font-black text-sm truncate" data-testid={`op-style-${s.code}`}>{s.code}</div>
                      <div className="text-xs text-slate-500 truncate">{s.name}</div>
                      <div className="mt-1 flex gap-1 flex-wrap">
                        <Badge color={s.online_status === "live" ? "green" : "gray"}>{s.online_status || "draft"}</Badge>
                        {cnt > 0
                          ? <Badge color="emerald">{cnt} components</Badge>
                          : <Badge color="amber">No BOM</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 flex divide-x divide-slate-200">
                    <button
                      onClick={() => setBomStyle(s)}
                      className="flex-1 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50"
                      data-testid={`op-edit-bom-${s.code}`}
                    >
                      <Wrench className="w-3.5 h-3.5 inline mr-1" />
                      {cnt > 0 ? "Edit Production Card" : "Create Production Card"}
                    </button>
                    <button
                      onClick={() => setProduceStyle(s)}
                      className="flex-1 py-2 text-xs font-bold uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800"
                      data-testid={`op-produce-${s.code}`}
                    >
                      <Hammer className="w-3.5 h-3.5 inline mr-1" />Produce
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {bomStyle && (
        <BomEditorDrawer
          style={bomStyle}
          onClose={() => { setBomStyle(null); load(); }}
          onSaved={() => load()}
        />
      )}
      {produceStyle && (
        <AdHocProduceDrawer
          style={produceStyle}
          hasBom={(bomCounts[produceStyle.id] || 0) > 0}
          onClose={() => setProduceStyle(null)}
          onEditBom={() => { setBomStyle(produceStyle); setProduceStyle(null); }}
          onDone={() => { setProduceStyle(null); load(); }}
        />
      )}
    </div>
  );
}


/* ────────────────────────────────────────────────────────────
   AdHocProduceDrawer — produce N pairs of (color, size) for a
   style without any pending order (online floor). Any excess
   over pending jobs (usually all) lands in stock via the same
   /production/produce-cell endpoint.
   ──────────────────────────────────────────────────────────── */
function AdHocProduceDrawer({ style, hasBom, onClose, onEditBom, onDone }) {
  const [color, setColor]           = useState("");
  const [size, setSize]             = useState("");
  const [qty, setQty]               = useState(10);
  const [useComponents, setUseComp] = useState(hasBom);
  const [busy, setBusy]             = useState(false);
  const [err, setErr]               = useState("");
  const [result, setResult]         = useState(null);

  const submit = async () => {
    setErr(""); setResult(null); setBusy(true);
    try {
      if (!color.trim() || !size.trim()) {
        setErr("Color and Size are both required."); setBusy(false); return;
      }
      const { data } = await http.post("/production/produce-cell", {
        style_id:       style.id,
        color:          color.trim(),
        size:           String(size).trim(),
        produced_qty:   Number(qty),
        use_components: useComponents,
        channel_filter: "online_channel",
      });
      setResult(data);
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.code === "no_production_card") {
        setErr("This style has no Production Card yet. Click 'Edit Production Card' below to add components, or turn off 'Deduct from Component Inventory' to produce from raw material.");
      } else {
        setErr(friendlyAxiosError(e));
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md border-2 border-slate-900 shadow-ind-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="adhoc-produce-drawer"
      >
        <div className="px-5 py-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SafeImage
              image={{ url: style.image_url, display_url: style.image_display_url, thumbnail_url: style.image_thumbnail_url }}
              alt={style.code}
              aspectRatio="1/1"
              className="w-12 h-12 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ad-hoc Production</div>
              <div className="font-mono font-black">{style.code}</div>
              <div className="text-xs text-slate-500 truncate">{style.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900" data-testid="adhoc-close"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            <div className="p-3 border-2 border-emerald-500 bg-emerald-50 text-emerald-900 text-xs">
              <div className="font-bold">Recorded</div>
              <div className="mt-1 space-y-0.5">
                <div>Produced <strong>{result.produced}</strong> pairs.</div>
                {result.pending_before > 0
                  ? <div>Consumed <strong>{result.pending_before}</strong> from pending orders.</div>
                  : <div>No pending orders matched — all pairs added directly to stock.</div>}
                {result.excess > 0 && <div>Excess of <strong>{result.excess}</strong> pairs placed at <strong className="font-mono">{result.excess_placed_at}</strong>.</div>}
                {result.bom_components_used?.length > 0 && (
                  <div>Components: {result.bom_components_used.map((c) => `${c.component_code} (-${c.deducted}, ${c.new_stock} left)`).join(", ")}</div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <BtnPrimary onClick={onDone} data-testid="adhoc-done">Done</BtnPrimary>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-600">Color</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Tan" className="w-full mt-0.5 border-2 border-slate-300 px-3 py-2 text-sm" data-testid="adhoc-color" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-600">Size</label>
              <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 7" className="w-full mt-0.5 border-2 border-slate-300 px-3 py-2 text-sm font-mono" data-testid="adhoc-size" />
            </div>

            <div className="text-center pt-1">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Pairs to produce</div>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setQty(Math.max(1, Number(qty) - 1))} className="w-10 h-10 border-2 border-slate-300 hover:border-slate-900 text-lg font-bold">−</button>
                <input type="number" value={qty} onChange={(e) => setQty(Math.max(0, Number(e.target.value)))} className="w-24 border-2 border-slate-300 px-2 py-2 text-center font-mono font-black text-2xl" data-testid="adhoc-qty" />
                <button onClick={() => setQty(Number(qty) + 1)} className="w-10 h-10 border-2 border-slate-300 hover:border-slate-900 text-lg font-bold">+</button>
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer text-xs pt-1">
              <input type="checkbox" checked={useComponents} onChange={(e) => setUseComp(e.target.checked)} className="mt-0.5" data-testid="adhoc-use-components" />
              <span>
                <span className="font-bold uppercase tracking-wider">Deduct from Component Inventory</span><br />
                <span className="text-slate-500">
                  Uncheck to produce directly from raw material without a BOM.
                  {!hasBom && (<> This style currently has <strong>no Production Card</strong>. </>)}
                </span>
              </span>
            </label>

            {err && (
              <div className="p-2 border-2 border-red-300 bg-red-50 text-red-900 text-xs" data-testid="adhoc-error">
                {err}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <BtnSecondary onClick={onEditBom} className="flex-1"><Wrench className="w-3.5 h-3.5 inline mr-1" />Edit Production Card</BtnSecondary>
              <BtnPrimary onClick={submit} disabled={busy || qty <= 0} className="flex-1" data-testid="adhoc-submit">
                {busy && <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />}
                <Package className="w-3.5 h-3.5 inline mr-1" />Produce
              </BtnPrimary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
