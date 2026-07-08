import { useEffect, useState, useRef, useMemo } from "react";
import { http, friendlyAxiosError } from "../lib/api";
import { PageHeader, Card, BtnPrimary, BtnSecondary, Input, Select, Badge } from "../components/ui-kit";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ClipboardList, X, Printer, ScanLine, CheckCircle2, Trash2, Zap, ZapOff } from "lucide-react";

const STATUS_COLORS = {
  pending: "yellow",
  in_progress: "blue",
  completed: "green",
  cancelled: "red",
};

const CHANNEL_COLORS = {
  myntra: "orange",
  flipkart: "blue",
  nykaa: "orange",
  website: "slate",
};

// Sanitize scanner-gun input — strip CR/LF/tabs, trim, uppercase
function cleanScan(s) {
  return String(s || "").replace(/[\r\n\t]/g, "").trim().toUpperCase();
}

export default function Picklists() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [statusFilter, setStatus] = useState("");
  const [channelFilter, setChannel] = useState("");
  const [search, setSearch]     = useState("");
  const [openId, setOpenId]     = useState(null);

  async function load() {
    setLoading(true); setErr("");
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (channelFilter) q.set("channel", channelFilter);
      const r = await http.get(`/picklists?${q.toString()}`);
      setRows(r.data);
    } catch (e) {
      setErr(friendlyAxiosError(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter, channelFilter]);

  const filtered = search
    ? rows.filter(r => r.picklist_no.toLowerCase().includes(search.toLowerCase()) ||
                       r.order_id.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <div data-testid="page-picklists">
      <div className="print:hidden">
        <PageHeader
          title="Picklists"
          subtitle="Online Commerce / WMS"
          action={
            <BtnSecondary onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </BtnSecondary>
          }
        />

        <div className="p-4 sm:p-6">
          {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm mb-4">{err}</div>}

          <Card className="p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Input label="Search" placeholder="Picklist no. or Order id…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select label="Status" value={statusFilter} onChange={e => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
              <Select label="Channel" value={channelFilter} onChange={e => setChannel(e.target.value)}>
                <option value="">All channels</option>
                <option value="myntra">Myntra</option>
                <option value="flipkart">Flipkart</option>
                <option value="nykaa">Nykaa</option>
                <option value="website">Website</option>
              </Select>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b-2 border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Picklist No.</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Order ID</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Channel</th>
                    <th className="text-right px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Items</th>
                    <th className="text-right px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Qty</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Picker</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500">No picklists match your filters.</td></tr>
                  )}
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-testid={`picklist-row-${r.picklist_no}`}>
                      <td className="px-4 py-3 font-mono font-bold">{r.picklist_no}</td>
                      <td className="px-4 py-3">{r.order_id}</td>
                      <td className="px-4 py-3"><Badge color={CHANNEL_COLORS[r.channel] || "slate"}>{r.channel}</Badge></td>
                      <td className="px-4 py-3 text-right">{r.total_items}</td>
                      <td className="px-4 py-3 text-right font-bold">{r.total_qty}</td>
                      <td className="px-4 py-3">{r.picker || <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-3"><Badge color={STATUS_COLORS[r.status] || "slate"}>{r.status.replace("_", " ")}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {openId && <PicklistDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function PicklistDrawer({ id, onClose, onChanged }) {
  const [pl, setPl]         = useState(null);
  const [err, setErr]       = useState("");
  const [scan, setScan]     = useState("");
  const [scanIdx, setScanIdx] = useState(null);
  const [scanMode, setScanMode] = useState(false);   // scanner-gun mode — auto-advance
  const [flash, setFlash]   = useState("");           // brief success/error flash
  const scanRef = useRef();
  const flashTimeout = useRef();

  async function load() {
    setErr("");
    try {
      const r = await http.get(`/picklists/${id}`);
      setPl(r.data);
      // In scan mode, auto-position on first unpicked item
      if (scanMode && r.data.status !== "completed" && r.data.status !== "cancelled") {
        const nextIdx = r.data.items.findIndex(it => !it.picked);
        if (nextIdx >= 0) {
          setScanIdx(nextIdx);
          setTimeout(() => scanRef.current && scanRef.current.focus(), 50);
        } else {
          setScanIdx(null);
        }
      }
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Handle scanner-mode toggle: start on first unpicked item, focus input
  function toggleScanMode() {
    if (!pl) return;
    if (scanMode) {
      setScanMode(false);
      setScanIdx(null);
      setScan("");
    } else {
      setScanMode(true);
      const nextIdx = pl.items.findIndex(it => !it.picked);
      if (nextIdx >= 0) {
        setScanIdx(nextIdx);
        setScan("");
        setTimeout(() => scanRef.current && scanRef.current.focus(), 100);
      }
    }
  }

  function briefFlash(msg, isErr = false) {
    setFlash(isErr ? `❌ ${msg}` : `✅ ${msg}`);
    clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(""), 1800);
  }

  async function confirmPick(idx, rawScan) {
    const cleaned = cleanScan(rawScan !== undefined ? rawScan : scan);
    if (!cleaned) {
      setErr("Please scan/enter the location before confirming.");
      return;
    }
    setErr("");
    try {
      const resp = await http.post(`/picklists/${id}/pick-item`, {
        item_index: idx,
        scanned_location: cleaned,
      });
      briefFlash(`Picked ${resp.data.items[idx].location_code}`);
      setScan("");
      const nextIdx = resp.data.items.findIndex(it => !it.picked);
      // In scan mode, auto-advance to next unpicked item
      if (scanMode && nextIdx >= 0) {
        setScanIdx(nextIdx);
        setTimeout(() => scanRef.current && scanRef.current.focus(), 50);
      } else if (nextIdx < 0) {
        setScanIdx(null);
      } else if (!scanMode) {
        setScanIdx(null);
      }
      setPl(resp.data);
      onChanged && onChanged();
    } catch (e) {
      const msg = friendlyAxiosError(e);
      setErr(msg);
      briefFlash(msg, true);
      // Keep scan focused for retry in scan mode
      if (scanMode) {
        setScan("");
        setTimeout(() => scanRef.current && scanRef.current.focus(), 50);
      }
    }
  }

  // Handle scanner-gun input: when auto-appended CR/LF is detected in Enter key press,
  // capture the raw value and submit immediately.
  function onScanKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmPick(scanIdx, e.target.value);
    }
  }

  async function del() {
    if (!window.confirm("Cancel this picklist and release reservations?")) return;
    try {
      await http.delete(`/picklists/${id}`);
      onChanged && onChanged();
      onClose();
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }

  async function assignPicker(name) {
    try {
      await http.patch(`/picklists/${id}`, { picker: name });
      await load();
    } catch (e) { setErr(friendlyAxiosError(e)); }
  }

  const printSheet = () => window.print();

  // Sort items by location_code for printed sheet (walking order)
  const sortedItems = useMemo(
    () => pl ? [...pl.items].map((it, i) => ({ ...it, __idx: i }))
                            .sort((a, b) => a.location_code.localeCompare(b.location_code))
             : [],
    [pl]
  );

  const pickedCount = pl ? pl.items.filter(i => i.picked).length : 0;
  const totalCount  = pl ? pl.items.length : 0;
  const progressPct = totalCount ? Math.round(pickedCount / totalCount * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end print:static print:bg-white print:block" onClick={onClose}>
      <div className="picklist-drawer bg-white w-full max-w-2xl h-full overflow-auto shadow-2xl print:max-w-none print:h-auto print:shadow-none print:overflow-visible" onClick={e => e.stopPropagation()}>
        {!pl ? (
          <div className="p-8 text-center text-slate-500">{err || "Loading…"}</div>
        ) : (
          <>
            {/* Print-only header */}
            <div className="hidden print:block px-6 py-4 border-b-2 border-slate-900">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">SSK Footcare — Warehouse Picklist</div>
                  <div className="font-black text-3xl font-mono mt-1">{pl.picklist_no}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-mono">{pl.order_id}</div>
                  <div className="uppercase">{pl.channel}</div>
                  <div className="text-xs text-slate-500 mt-1">{new Date(pl.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                <div><span className="text-slate-500">Picker:</span> <strong>{pl.picker || "________________"}</strong></div>
                <div><span className="text-slate-500">Items:</span> <strong>{pl.total_items}</strong></div>
                <div><span className="text-slate-500">Total Qty:</span> <strong>{pl.total_qty} pairs</strong></div>
                <div><span className="text-slate-500">Status:</span> <strong className="uppercase">{pl.status.replace("_", " ")}</strong></div>
              </div>
            </div>

            {/* Screen header */}
            <div className="print:hidden px-5 py-4 border-b-2 border-slate-900 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Picklist</div>
                <div className="font-black text-2xl font-mono">{pl.picklist_no}</div>
              </div>
              <div className="flex gap-2">
                {pl.status !== "completed" && pl.status !== "cancelled" && (
                  <BtnSecondary
                    onClick={toggleScanMode}
                    className={scanMode ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" : ""}
                    data-testid="btn-scan-mode"
                  >
                    {scanMode ? <><Zap className="w-3.5 h-3.5 inline mr-1" />Scan Mode</> : <><ZapOff className="w-3.5 h-3.5 inline mr-1" />Scan Mode</>}
                  </BtnSecondary>
                )}
                <BtnSecondary onClick={printSheet}><Printer className="w-3.5 h-3.5 inline mr-1" />Print</BtnSecondary>
                {pl.status !== "completed" && (
                  <BtnSecondary onClick={del} className="text-red-700 border-red-300 hover:border-red-700"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Cancel</BtnSecondary>
                )}
                <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Screen body */}
            <div className="p-5 space-y-5 print:hidden">
              {err && <div className="p-3 bg-red-50 border-2 border-red-300 text-red-800 text-sm">{err}</div>}
              {flash && (
                <div className={`p-3 border-2 text-sm font-bold ${flash.startsWith("❌") ? "bg-red-50 border-red-300 text-red-800" : "bg-emerald-50 border-emerald-400 text-emerald-800"}`}>
                  {flash}
                </div>
              )}

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Picked {pickedCount} of {totalCount} items</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 bg-slate-200 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Order</span><div className="font-bold font-mono">{pl.order_id}</div></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Channel</span><div><Badge color={CHANNEL_COLORS[pl.channel] || "slate"}>{pl.channel}</Badge></div></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Status</span><div><Badge color={STATUS_COLORS[pl.status] || "slate"}>{pl.status.replace("_", " ")}</Badge></div></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider">Picker</span>
                  <div className="flex gap-2">
                    <input
                      className="border border-slate-300 px-2 py-1 text-sm w-40 font-mono"
                      value={pl.picker || ""}
                      onChange={e => setPl({ ...pl, picker: e.target.value })}
                      onBlur={e => e.target.value !== (pl.picker || "") && assignPicker(e.target.value)}
                      placeholder="Assign picker…"
                      disabled={pl.status === "completed" || pl.status === "cancelled"}
                    />
                  </div>
                </div>
              </div>

              {/* Persistent scanner input at top when scan mode is on */}
              {scanMode && scanIdx !== null && pl.items[scanIdx] && (
                <div className="p-4 bg-emerald-50 border-4 border-emerald-500 sticky top-24 z-10">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-800 mb-2 flex items-center gap-1">
                    <ScanLine className="w-3.5 h-3.5" />
                    Scan location for item {scanIdx + 1} of {totalCount}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 text-center">
                      <div className="text-[10px] text-slate-500 mb-1">Expected</div>
                      <div className="text-2xl font-mono font-black bg-white border-2 border-slate-900 px-3 py-2">{pl.items[scanIdx].location_code}</div>
                    </div>
                    <div className="flex-1">
                      <input
                        ref={scanRef}
                        value={scan}
                        onChange={e => setScan(cleanScan(e.target.value))}
                        onKeyDown={onScanKeyDown}
                        placeholder="Scan or type…"
                        autoFocus
                        className="w-full border-4 border-emerald-500 px-4 py-3 text-2xl font-mono focus:border-emerald-700 focus:outline-none"
                        data-testid="scan-mode-input"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">
                        Scanner gun: fire the trigger — Enter is auto-processed. Pick <strong>{pl.items[scanIdx].qty} pairs</strong> of <strong>{pl.items[scanIdx].style_code} · {pl.items[scanIdx].color} · Size {pl.items[scanIdx].size}</strong>.
                      </div>
                    </div>
                    <BtnPrimary onClick={() => confirmPick(scanIdx)}>Confirm</BtnPrimary>
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  Items ({pl.items.length}) — Total {pl.total_qty} pairs
                </div>

                <div className="border border-slate-300">
                  {pl.items.map((it, idx) => {
                    const active = scanIdx === idx && !scanMode;
                    const isNext = scanMode && scanIdx === idx;
                    return (
                      <div key={idx} className={`border-b border-slate-200 last:border-b-0 ${it.picked ? "bg-green-50" : isNext ? "bg-emerald-50 border-l-4 border-l-emerald-500" : ""}`}>
                        <div className="px-4 py-3 flex items-center gap-4">
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <QRCodeSVG value={it.location_code} size={72} />
                            <div className="text-[10px] font-mono font-bold mt-1">{it.location_code}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold font-mono">{it.style_code} · {it.color} · Size {it.size}</div>
                            <div className="text-xs text-slate-500 mt-0.5">Rack {it.rack} · Row {it.row} · Col {it.column}</div>
                            <div className="text-2xl font-black mt-1">{it.qty} <span className="text-xs font-normal text-slate-500">pairs</span></div>
                          </div>
                          <div className="flex-shrink-0">
                            {it.picked ? (
                              <Badge color="green"><CheckCircle2 className="w-3 h-3 inline mr-1" />Picked</Badge>
                            ) : (
                              !scanMode && (
                                <BtnPrimary onClick={() => { setScanIdx(idx); setScan(""); setTimeout(() => scanRef.current && scanRef.current.focus(), 50); }} disabled={pl.status === "cancelled"}>
                                  <ScanLine className="w-3.5 h-3.5 inline mr-1" />Pick
                                </BtnPrimary>
                              )
                            )}
                          </div>
                        </div>
                        {active && !it.picked && (
                          <div className="px-4 pb-3 pt-1 bg-yellow-50 border-t border-yellow-200">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-600 mb-1">Scan or enter location code</div>
                            <div className="flex gap-2">
                              <input
                                ref={scanRef}
                                value={scan}
                                onChange={e => setScan(cleanScan(e.target.value))}
                                onKeyDown={onScanKeyDown}
                                placeholder={`Expected: ${it.location_code}`}
                                className="flex-1 border-2 border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#2563EB] focus:outline-none"
                                data-testid={`scan-input-${idx}`}
                                autoFocus
                              />
                              <BtnPrimary onClick={() => confirmPick(idx)}>Confirm</BtnPrimary>
                              <BtnSecondary onClick={() => { setScanIdx(null); setScan(""); }}>Cancel</BtnSecondary>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {pl.status === "completed" && (
                <div className="text-xs text-slate-500">Completed at {new Date(pl.completed_at).toLocaleString()}</div>
              )}
            </div>

            {/* Print-only body — sorted by location for walking order */}
            <div className="hidden print:block px-6 py-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-2 pr-2 w-8">#</th>
                    <th className="text-left py-2 pr-2">Location</th>
                    <th className="text-left py-2 pr-2">Style / Color / Size</th>
                    <th className="text-right py-2 pr-2 w-16">Qty</th>
                    <th className="text-center py-2 w-16">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((it, i) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="py-3 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <QRCodeSVG value={it.location_code} size={40} />
                          <span className="font-mono font-black text-lg">{it.location_code}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 ml-12">Rack {it.rack} · Row {it.row} · Col {it.column}</div>
                      </td>
                      <td className="py-3 pr-2 font-mono">
                        <div className="font-bold">{it.style_code}</div>
                        <div className="text-xs">{it.color} · Size {it.size}</div>
                      </td>
                      <td className="py-3 pr-2 text-right font-black text-lg">{it.qty}</td>
                      <td className="py-3 text-center">
                        <div className="border-2 border-slate-900 w-6 h-6 mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 text-xs text-slate-500 border-t border-slate-300 pt-2 flex justify-between">
                <span>Picker signature: __________________________</span>
                <span>Time: __________</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
