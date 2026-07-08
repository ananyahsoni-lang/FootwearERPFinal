import { useEffect, useState } from "react";
import { http, friendlyAxiosError } from "../lib/api";
import { PageHeader, Card, BtnSecondary, Badge, Select } from "../components/ui-kit";
import { Printer, RefreshCw, Package, AlertTriangle, CheckCircle2 } from "lucide-react";

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

  const filtered = rows.filter(r => {
    if (filter === "available") return r.components_available;
    if (filter === "shortage")  return !r.components_available;
    return true;
  });

  const totals = {
    total: rows.length,
    available: rows.filter(r => r.components_available).length,
    shortage:  rows.filter(r => !r.components_available).length,
    pairs:     rows.reduce((s, r) => s + (r.quantity || 0), 0),
  };

  return (
    <div data-testid="page-pending-list">
      {/* Print-hidden header when printing */}
      <div className="print:hidden">
        <PageHeader
          title="Pending Product List"
          subtitle="Production / Online orders awaiting manufacture"
          action={
            <div className="flex gap-2">
              <BtnSecondary onClick={load} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
              </BtnSecondary>
              <BtnSecondary onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5 inline mr-1" />Print
              </BtnSecondary>
            </div>
          }
        />
      </div>

      {/* Print header */}
      <div className="hidden print:block px-6 py-4 border-b-2 border-slate-900">
        <div className="text-xs uppercase tracking-widest text-slate-500">SSK Footcare · Production</div>
        <h1 className="text-2xl font-black">Pending Product List</h1>
        <div className="text-xs text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm print:hidden">{err}</div>}

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        {/* Filter tabs */}
        <div className="flex gap-2 print:hidden">
          <BtnSecondary onClick={() => setFilter("all")}       className={filter === "all"       ? "bg-slate-900 text-white border-slate-900" : ""}>All ({totals.total})</BtnSecondary>
          <BtnSecondary onClick={() => setFilter("available")} className={filter === "available" ? "bg-green-700 text-white border-green-700" : ""}>Ready ({totals.available})</BtnSecondary>
          <BtnSecondary onClick={() => setFilter("shortage")}  className={filter === "shortage"  ? "bg-red-700 text-white border-red-700"    : ""}>Shortage ({totals.shortage})</BtnSecondary>
        </div>

        {/* Card list — mobile-friendly */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-12">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
              No pending production jobs. 🎉
            </div>
          )}
          {filtered.map(j => (
            <Card key={j.id} className={`p-4 border-l-8 ${j.components_available ? "border-l-green-500" : "border-l-red-500"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{j.channel} · {j.po_number}</div>
                  <div className="font-mono font-bold text-lg mt-0.5 truncate">{j.style_code}</div>
                </div>
                {j.components_available ? (
                  <Badge color="green">Ready</Badge>
                ) : (
                  <Badge color="red"><AlertTriangle className="w-3 h-3 inline mr-1" />Shortage</Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Color</div>
                  <div className="font-bold">{j.color || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Size</div>
                  <div className="font-bold">{j.size || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Qty</div>
                  <div className="font-bold text-2xl">{j.quantity}</div>
                </div>
              </div>

              {j.fulfilled_from_stock_qty > 0 && (
                <div className="mt-2 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1">
                  <Package className="w-3 h-3 inline mr-1" />
                  {j.fulfilled_from_stock_qty} of {j.original_order_qty} pairs already shipped from ready stock
                </div>
              )}

              <div className="mt-2 text-[10px] text-slate-500">
                Stage: <strong className="uppercase">{j.stage}</strong> · Created {new Date(j.created_at).toLocaleDateString()}
              </div>

              {!j.components_available && j.component_shortages && j.component_shortages.length > 0 && (
                <div className="mt-2 text-[10px] text-red-700 bg-red-50 border border-red-200 px-2 py-1">
                  <div className="font-bold mb-1">Missing components:</div>
                  {j.component_shortages.slice(0, 3).map((s, i) => (
                    <div key={i}>{s.component_code} · {s.component_name} (avail {s.available})</div>
                  ))}
                  {j.component_shortages.length > 3 && <div>+{j.component_shortages.length - 3} more…</div>}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
