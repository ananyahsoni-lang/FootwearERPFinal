import { useEffect, useMemo, useState } from "react";
import { http, friendlyAxiosError } from "../lib/api";
import { PageHeader, Card, BtnSecondary, Badge } from "../components/ui-kit";
import { SafeImage } from "../components/ImageUploader";
import { Printer, RefreshCw, Package, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Groups pending production jobs into a (style_code, color) matrix so that
 * the same style ordered by many buyers on many sizes shows as ONE row with
 * quantities laid out across sizes — matching the Production Card / Picklist
 * layout for consistency and print-readability.
 */
function useMatrix(rows) {
  return useMemo(() => {
    if (!rows || rows.length === 0) return { groups: [], allSizes: [] };
    const map = {};
    for (const r of rows) {
      const key = `${r.style_code || "—"}||${r.color || "—"}`;
      if (!map[key]) {
        map[key] = {
          style_code:           r.style_code || "—",
          style_name:           r.style_name || "",
          color:                r.color || "—",
          image_url:            r.image_url || "",
          image_display_url:    r.image_display_url || "",
          image_thumbnail_url:  r.image_thumbnail_url || "",
          sizes:                {},         // size → { qty, jobs: [], components_available }
          total:                0,
          any_shortage:         false,
          shortages:            [],
          orders:               new Set(), // distinct PO/order numbers
        };
      }
      const g = map[key];
      const sz = String(r.size || "—");
      if (!g.sizes[sz]) g.sizes[sz] = { qty: 0, jobs: 0, ready: true };
      g.sizes[sz].qty  += Number(r.quantity || 0);
      g.sizes[sz].jobs += 1;
      if (!r.components_available) {
        g.sizes[sz].ready = false;
        g.any_shortage     = true;
        (r.component_shortages || []).forEach((s) => {
          const k = `${s.component_code}||${s.component_name}`;
          if (!g.shortages.some((x) => `${x.component_code}||${x.component_name}` === k)) {
            g.shortages.push(s);
          }
        });
      }
      g.total += Number(r.quantity || 0);
      if (r.po_number) g.orders.add(r.po_number);
    }
    const groups = Object.values(map)
      .map((g) => ({ ...g, orders: [...g.orders] }))
      .sort((a, b) => {
        // Rows with any shortage bubble to the top for attention
        if (a.any_shortage !== b.any_shortage) return a.any_shortage ? -1 : 1;
        return (a.style_code || "").localeCompare(b.style_code || "");
      });
    const allSizesSet = new Set();
    groups.forEach((g) => Object.keys(g.sizes).forEach((s) => allSizesSet.add(s)));
    const allSizes = [...allSizesSet].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    return { groups, allSizes };
  }, [rows]);
}

export default function PendingProductList() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState("");
  const [filter, setFilter] = useState("all"); // all | available | shortage

  async function load() {
    setLoad(true); setErr("");
    try {
      const r = await http.get("/production/pending-list");
      setRows(r.data);
    } catch (e) { setErr(friendlyAxiosError(e)); }
    finally { setLoad(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (filter === "available") return r.components_available;
    if (filter === "shortage")  return !r.components_available;
    return true;
  });

  const totals = {
    total:     rows.length,
    available: rows.filter((r) => r.components_available).length,
    shortage:  rows.filter((r) => !r.components_available).length,
    pairs:     rows.reduce((s, r) => s + (r.quantity || 0), 0),
  };

  const { groups, allSizes } = useMatrix(filtered);

  return (
    <div data-testid="page-pending-list" className="print:bg-white">
      {/* Screen header (hidden on print) */}
      <div className="print:hidden">
        <PageHeader
          title="Pending Product List"
          subtitle="Production / Online orders awaiting manufacture"
          testId="pending-list-header"
          action={
            <div className="flex gap-2">
              <BtnSecondary onClick={load} disabled={loading} data-testid="pending-refresh-btn">
                <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
              </BtnSecondary>
              <BtnSecondary onClick={() => window.print()} data-testid="pending-print-btn">
                <Printer className="w-3.5 h-3.5 inline mr-1" />Print
              </BtnSecondary>
            </div>
          }
        />
      </div>

      {/* Print header */}
      <div className="hidden print:block px-6 py-4 border-b-2 border-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">SSK Footcare · Production</div>
            <h1 className="text-2xl font-black">Pending Product List</h1>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Generated: <strong>{new Date().toLocaleString()}</strong></div>
            <div>Total groups: <strong>{groups.length}</strong> · Total pairs: <strong>{totals.pairs.toLocaleString()}</strong></div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 print:p-6 print:space-y-3">
        {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm print:hidden">{err}</div>}

        {/* Summary tiles (screen only) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Pending</div>
            <div className="text-3xl font-black mt-1">{totals.total}</div>
            <div className="text-xs text-slate-500 mt-1">jobs</div>
          </Card>
          <Card className="p-4 border-green-300">
            <div className="text-[10px] uppercase tracking-wider font-bold text-green-700">Ready to Produce</div>
            <div className="text-3xl font-black mt-1 text-green-800">{totals.available}</div>
            <div className="text-xs text-slate-500 mt-1">components available</div>
          </Card>
          <Card className="p-4 border-red-300">
            <div className="text-[10px] uppercase tracking-wider font-bold text-red-700">Awaiting Components</div>
            <div className="text-3xl font-black mt-1 text-red-800">{totals.shortage}</div>
            <div className="text-xs text-slate-500 mt-1">component shortage</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Pairs</div>
            <div className="text-3xl font-black mt-1">{totals.pairs.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">to manufacture</div>
          </Card>
        </div>

        {/* Filter tabs (screen only) */}
        <div className="flex gap-2 print:hidden">
          <BtnSecondary onClick={() => setFilter("all")}       className={filter === "all"       ? "bg-slate-900 text-white border-slate-900" : ""} data-testid="filter-all">All ({totals.total})</BtnSecondary>
          <BtnSecondary onClick={() => setFilter("available")} className={filter === "available" ? "bg-green-700 text-white border-green-700" : ""} data-testid="filter-available">Ready ({totals.available})</BtnSecondary>
          <BtnSecondary onClick={() => setFilter("shortage")}  className={filter === "shortage"  ? "bg-red-700 text-white border-red-700"    : ""} data-testid="filter-shortage">Shortage ({totals.shortage})</BtnSecondary>
        </div>

        {groups.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            No pending production jobs.
          </div>
        )}

        {/* Matrix cards — same layout on screen AND print, print-friendly by default */}
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div
              key={gi}
              className={`border-2 break-inside-avoid print:shadow-none ${
                g.any_shortage ? "border-red-500" : "border-slate-900"
              } bg-white`}
              data-testid={`pending-group-${g.style_code}-${g.color}`}
            >
              <div className="flex items-stretch">
                {/* Product image */}
                <div className="w-28 flex-shrink-0 border-r-2 border-slate-900 bg-slate-50 flex items-center justify-center print:w-24">
                  <SafeImage
                    image={{
                      url: g.image_url,
                      display_url: g.image_display_url,
                      thumbnail_url: g.image_thumbnail_url,
                    }}
                    alt={g.style_code}
                    aspectRatio="1/1"
                    className="w-full"
                  />
                </div>
                {/* Header + matrix */}
                <div className="flex-1 min-w-0">
                  <div className="px-3 py-2 border-b-2 border-slate-900 bg-slate-100 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono font-black text-base truncate">{g.style_code}</div>
                      {g.style_name && <div className="text-[10px] text-slate-600 truncate">{g.style_name}</div>}
                      <div className="text-[11px] font-bold uppercase tracking-wider">Color: <span className="font-mono">{g.color}</span></div>
                      {g.orders.length > 0 && (
                        <div className="text-[9px] text-slate-500 truncate">
                          Orders: {g.orders.slice(0, 4).join(", ")}
                          {g.orders.length > 4 ? ` +${g.orders.length - 4} more` : ""}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[9px] uppercase text-slate-500">Group Total</div>
                      <div className="text-2xl font-black font-mono">{g.total}</div>
                      <div className="text-[9px] uppercase text-slate-500">pairs</div>
                      {g.any_shortage ? (
                        <Badge color="red" className="print:border print:bg-white print:text-red-700">
                          <AlertTriangle className="w-3 h-3 inline mr-0.5" /> Shortage
                        </Badge>
                      ) : (
                        <Badge color="green" className="print:border print:bg-white print:text-green-800">Ready</Badge>
                      )}
                    </div>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-400 px-2 py-1 text-left w-16">Size</th>
                        {allSizes.map((sz) => (
                          <th key={sz} className="border border-slate-400 px-1 py-1 text-center font-mono">{sz}</th>
                        ))}
                        <th className="border border-slate-400 px-2 py-1 text-center bg-slate-200 w-16">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-400 px-2 py-1 font-bold uppercase text-[10px]">Qty</td>
                        {allSizes.map((sz) => {
                          const cell = g.sizes[sz];
                          return (
                            <td
                              key={sz}
                              className={`border border-slate-400 px-1 py-1 text-center font-mono font-bold ${
                                cell
                                  ? cell.ready
                                    ? "bg-white text-slate-900"
                                    : "bg-red-50 text-red-800"
                                  : "bg-slate-50 text-slate-300"
                              }`}
                            >
                              {cell ? cell.qty : "·"}
                            </td>
                          );
                        })}
                        <td className="border border-slate-400 px-2 py-1 text-center bg-slate-100 font-black font-mono text-base">{g.total}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-400 px-2 py-1 font-bold uppercase text-[10px]">Made</td>
                        {allSizes.map((sz) => (
                          <td key={sz} className="border border-slate-400 px-1 py-1 text-center">
                            <div className="border-2 border-slate-500 w-5 h-5 mx-auto" />
                          </td>
                        ))}
                        <td className="border border-slate-400 px-2 py-1 text-center">
                          <div className="border-2 border-slate-900 w-6 h-6 mx-auto" title="All done" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {g.any_shortage && g.shortages.length > 0 && (
                    <div className="px-3 py-1.5 bg-red-50 border-t-2 border-red-500 text-[10px] text-red-800">
                      <span className="font-bold uppercase tracking-wider">Missing components:</span>{" "}
                      {g.shortages.slice(0, 4).map((s, i) => (
                        <span key={i} className="mr-2">
                          {s.component_code} · {s.component_name} (avail {s.available})
                          {i < Math.min(3, g.shortages.length - 1) ? "," : ""}
                        </span>
                      ))}
                      {g.shortages.length > 4 && <span>+{g.shortages.length - 4} more…</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Print footer */}
        <div className="hidden print:flex justify-between text-xs text-slate-500 border-t border-slate-300 pt-2 mt-6">
          <span>Prepared by: __________________________</span>
          <span>Verified by: __________________________</span>
          <span>Date: __________</span>
        </div>
      </div>
    </div>
  );
}
