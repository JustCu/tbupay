import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ImageOff,
  ShieldCheck,
  InboxIcon,
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Users,
} from "lucide-react";
import {
  getTransactions,
  verifyTransaction,
} from "../application/use-cases/transactions/transactionUseCases";
import { getUsers } from "../application/use-cases/users/userUseCases";
import useStore from "../store/useStore";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import usePullToRefresh from "../hooks/usePullToRefresh";

const FILTERS = [
  { key: "pending", label: "Menunggu" },
  { key: "all", label: "Semua" },
  { key: "verified", label: "Terverifikasi" },
  { key: "rejected", label: "Ditolak" },
  { key: "belum_bayar", label: "Belum Bayar" },
];

/** Format YYYY-MM ke nama bulan Indonesia */
function formatBulan(ym) {
  if (!ym) return "";
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

/** Konversi berbagai format URL Google Drive ke URL gambar yang bisa diembed di <img> */
function getDriveImgUrl(url) {
  if (!url) return null;
  // Sudah format lh3 CDN — langsung pakai
  if (url.includes("lh3.googleusercontent.com")) return url;
  // Ekstrak file ID dari berbagai format Drive URL
  const m =
    url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) {
    // lh3.googleusercontent.com/d/ID — CDN Google yang tidak kena anti-hotlink
    return `https://lh3.googleusercontent.com/d/${m[1]}=s800`;
  }
  return url;
}

function formatRp(val) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(val) || 0);
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 2) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay === 1) return "Kemarin";
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminVerifikasi() {
  const user = useStore((s) => s.user);
  const showAlert = useStore((s) => s.showAlert);
  const showConfirm = useStore((s) => s.showConfirm);
  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          return [...parsed.response.data].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [userMap, setUserMap] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          const map = {};
          parsed.response.data.forEach((t) => {
            if (!map[t.id_user]) map[t.id_user] = t.id_user;
          });
          return map;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  // ── Daftar warga (untuk tab Belum Bayar) ───────────────────
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  /** Bulan penagihan yang dipantau — format YYYY-MM, default bulan ini */
  const [unpaidMonth, setUnpaidMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) return false;
    } catch (e) {
      console.error(e);
    }
    return true;
  });

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [processingId, setProcessingId] = useState(null);

  const [dataSource, setDataSource] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) return "cache";
    } catch (e) {
      console.error(e);
    }
    return "network";
  });

  const fetchData = useCallback(
    async (showRefresh = false, forceRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else {
        setLoading(() => {
          try {
            const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
            if (cached) return false;
          } catch {}
          return true;
        });
      }

      try {
        const [trxRes, usersRes] = await Promise.all([
          getTransactions(forceRefresh ? { forceRefresh: true } : {}),
          getUsers(forceRefresh ? { forceRefresh: true } : {}),
        ]);

        if (trxRes?._meta?.source) setDataSource(trxRes._meta.source);

        if (trxRes.status === "success") {
          const sorted = [...trxRes.data].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          );
          setTransactions(sorted);
          const map = {};
          sorted.forEach((t) => {
            if (!map[t.id_user]) map[t.id_user] = t.id_user;
          });
          setUserMap(map);
        }

        if (usersRes.status === "success") {
          setUsers(usersRes.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setLoadingUsers(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Hitung warga/admin yang belum bayar untuk bulan `unpaidMonth`.
   * Deteksi: tidak ada transaksi jenis=pemasukan dengan timestamp
   * di bulan yang dipilih dan status != rejected.
   */
  const { unpaidList, paidList } = useMemo(() => {
    const [year, month] = unpaidMonth.split("-").map(Number);
    const obligatoryUsers = users.filter(
      (u) => u.role === "warga" || u.role === "admin"
    );

    const paid = [];
    const unpaid = [];

    for (const u of obligatoryUsers) {
      const hasPaid = transactions.some((t) => {
        if (String(t.id_user) !== String(u.id_user)) return false;
        if (t.jenis !== "pemasukan") return false;
        if (t.status === "rejected") return false;
        const d = new Date(t.timestamp);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      // Cari detail transaksi yang sudah dibayar (untuk badge status)
      const paidTrx = hasPaid
        ? transactions.find((t) => {
            if (String(t.id_user) !== String(u.id_user)) return false;
            if (t.jenis !== "pemasukan") return false;
            if (t.status === "rejected") return false;
            const d = new Date(t.timestamp);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          })
        : null;

      if (hasPaid) {
        paid.push({ user: u, trx: paidTrx });
      } else {
        unpaid.push({ user: u });
      }
    }

    // Urutkan: blok_rumah ascending
    unpaid.sort((a, b) => (a.user.blok_rumah || "").localeCompare(b.user.blok_rumah || ""));
    paid.sort((a, b) => (a.user.blok_rumah || "").localeCompare(b.user.blok_rumah || ""));

    return { unpaidList: unpaid, paidList: paid };
  }, [transactions, users, unpaidMonth]);

  const pull = usePullToRefresh({
    onRefresh: () => fetchData(true, true),
    disabled: loading || refreshing || Boolean(processingId),
  });

  const handleAction = async (trx, actionType) => {
    const label = actionType === "verify" ? "verifikasi" : "tolak";
    const isVerify = actionType === "verify";
    showConfirm(
      `${trx.keterangan}\n${formatRp(trx.nominal)}`,
      async () => {
        setProcessingId(trx.id_transaksi);
        try {
          const res = await verifyTransaction({
            id_transaksi: trx.id_transaksi,
            action_type: isVerify ? "verify" : "reject",
          });
          if (res.status === "success") {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id_transaksi === trx.id_transaksi
                  ? { ...t, status: isVerify ? "verified" : "rejected" }
                  : t,
              ),
            );
          } else {
            showAlert("Gagal: " + res.message, {
              variant: "danger",
              title: "Gagal",
            });
          }
        } catch (err) {
          showAlert("Terjadi kesalahan koneksi.", {
            variant: "danger",
            title: "Kesalahan Koneksi",
          });
        } finally {
          setProcessingId(null);
        }
      },
      {
        title: isVerify ? "Setujui Pembayaran" : "Tolak Pembayaran",
        variant: isVerify ? "success" : "danger",
        confirmLabel: isVerify ? "Setujui" : "Tolak",
        cancelLabel: "Batal",
      },
    );
  };

  // Stats
  const pendingCount = transactions.filter((t) => t.status === "pending").length;
  const verifiedCount = transactions.filter((t) => t.status === "verified").length;
  const rejectedCount = transactions.filter((t) => t.status === "rejected").length;

  // Filtered list (only for non-belum_bayar tabs)
  const filtered =
    filter === "all"
      ? transactions
      : filter === "belum_bayar"
        ? [] // unused — rendered separately
        : transactions.filter((t) => t.status === filter);

  // Guard: only admin can see this page
  if (user?.role !== "admin") {
    return (
      <div className="pb-6">
        <div className="text-center py-12 px-4 text-gray-400 flex flex-col items-center gap-2">
          <ShieldCheck size={48} color="#9ca3af" />
          <p className="text-[14px] font-semibold text-gray-700 m-0">Akses Terbatas</p>
          <span className="text-[12px]">Halaman ini hanya untuk Admin.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 animate-[fadeIn_0.3s_ease-in-out]" {...pull.bind}>
      {pull.showPullHint && (
        <div className={`sticky top-2 z-[31] mx-auto mb-2.5 w-fit px-3 py-[7px] rounded-full border text-xs font-semibold ${pull.isReady ? "border-green-300 bg-green-50 text-green-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}>
          {pull.isReady ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang"}
        </div>
      )}
      <CacheFallbackBadge source={dataSource} />
      {/* Header */}
      <div className="py-4 pb-3 flex justify-between items-center">
        <div>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 m-0">Verifikasi Pembayaran</h2>
          <p className="text-[12px] text-gray-400 mt-[2px] m-0">
            {filter === "belum_bayar" ? "Pantauan iuran bulanan warga" : "Tinjau bukti bayar warga"}
          </p>
        </div>
        <button
          className="p-2 bg-gray-100 dark:bg-slate-800/60 rounded-full border-none cursor-pointer text-gray-500 dark:text-slate-400 flex items-center justify-center transition-colors hover:bg-gray-200 dark:hover:bg-slate-700/60 active:scale-95 disabled:opacity-50"
          onClick={() => fetchData(true, true)}
          disabled={refreshing}
          title="Muat ulang data"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="bg-white dark:bg-[#1a2640] rounded-[14px] p-[14px_10px] text-center border border-gray-100 dark:border-slate-800/80 cursor-pointer" onClick={() => setFilter("pending")}>
          <div className="text-[22px] font-extrabold text-amber-500">{pendingCount}</div>
          <div className="text-[10px] text-gray-400 mt-[2px] uppercase font-semibold">Menunggu</div>
        </div>
        <div
          className="bg-white dark:bg-[#1a2640] rounded-[14px] p-[14px_10px] text-center border border-gray-100 dark:border-slate-800/80 cursor-pointer"
          onClick={() => setFilter("verified")}
        >
          <div className="text-[22px] font-extrabold text-green-500">{verifiedCount}</div>
          <div className="text-[10px] text-gray-400 mt-[2px] uppercase font-semibold">Terverifikasi</div>
        </div>
        <div
          className="bg-white dark:bg-[#1a2640] rounded-[14px] p-[14px_10px] text-center border border-gray-100 dark:border-slate-800/80 cursor-pointer"
          onClick={() => setFilter("rejected")}
        >
          <div className="text-[22px] font-extrabold text-red-500">{rejectedCount}</div>
          <div className="text-[10px] text-gray-400 mt-[2px] uppercase font-semibold">Ditolak</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`p-[6px_16px] rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#1a2640] text-[12px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer whitespace-nowrap transition-all ${filter === f.key ? "!bg-blue-600 !border-blue-600 !text-white" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === "pending" && pendingCount > 0 && (
              <span
                className={`ml-1.5 rounded-full p-[1px_6px] text-[10px] font-bold ${filter === "pending" ? "bg-white/30 text-white" : "bg-amber-100 text-amber-600"}`}
              >
                {pendingCount}
              </span>
            )}
            {f.key === "belum_bayar" && unpaidList.length > 0 && (
              <span
                className={`ml-1.5 rounded-full p-[1px_6px] text-[10px] font-bold ${filter === "belum_bayar" ? "bg-white/30 text-white" : "bg-red-100 text-red-600"}`}
              >
                {unpaidList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Belum Bayar ── */}
      {filter === "belum_bayar" ? (
        <div className="flex flex-col gap-4">
          {/* Bulan Penagihan Picker */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="month"
                className="w-full border border-gray-200 dark:border-[#2c3c5e] rounded-xl pl-9 pr-3 py-2.5 text-[12px] bg-white dark:bg-[#1b2641] text-gray-700 dark:text-gray-250 focus:outline-none focus:border-blue-400 appearance-none"
                value={unpaidMonth}
                onChange={(e) => setUnpaidMonth(e.target.value)}
              />
            </div>
          </div>

          {/* Summary bar */}
          {!loading && !loadingUsers && (
            <div className={`flex items-center gap-3 rounded-xl p-3.5 ${
              unpaidList.length === 0
                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40"
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                unpaidList.length === 0 ? "bg-emerald-100 dark:bg-emerald-800/40" : "bg-red-100 dark:bg-red-800/40"
              }`}>
                {unpaidList.length === 0
                  ? <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                  : <AlertCircle size={18} className="text-red-600 dark:text-red-400" />}
              </div>
              <div>
                <p className={`text-[13px] font-bold m-0 ${
                  unpaidList.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}>
                  {unpaidList.length === 0
                    ? `Semua warga sudah bayar ${formatBulan(unpaidMonth)}`
                    : `${unpaidList.length} dari ${unpaidList.length + paidList.length} warga belum bayar`}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 m-0 mt-0.5">
                  Bulan penagihan: {formatBulan(unpaidMonth)}
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {(loading || loadingUsers) && (
            <div className="text-center py-10 text-gray-400 text-[13px]">
              <RefreshCw size={28} className="mx-auto mb-2 block animate-spin" />
              Memuat data...
            </div>
          )}

          {/* Daftar Belum Bayar */}
          {!loading && !loadingUsers && unpaidList.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider m-0">Belum Bayar ({unpaidList.length})</p>
              {unpaidList.map(({ user: u }) => (
                <div key={u.id_user} className="bg-white dark:bg-[#1a2640] rounded-2xl border border-red-100 dark:border-red-900/30 p-[13px_16px] flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-[14px] font-extrabold text-red-600 dark:text-red-400 shrink-0">
                    {u.nama?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 truncate">{u.nama}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{u.blok_rumah}</span>
                      {u.no_hp && <span>· {u.no_hp}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full shrink-0">
                    Belum Bayar
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Daftar Sudah Bayar */}
          {!loading && !loadingUsers && paidList.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider m-0">Sudah Bayar ({paidList.length})</p>
              {paidList.map(({ user: u, trx }) => (
                <div key={u.id_user} className="bg-white dark:bg-[#1a2640] rounded-2xl border border-emerald-100 dark:border-emerald-900/30 p-[13px_16px] flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] opacity-75">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-[14px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                    {u.nama?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 truncate">{u.nama}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{u.blok_rumah}</span>
                      {trx && (
                        <span className="text-[10px] font-semibold text-gray-400">
                          · {trx.status === "verified" ? "✅ Terverifikasi" : "⏳ Menunggu verif"}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full shrink-0">
                    Sudah Bayar
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      /* ── Tab: Transaksi biasa ── */
      loading ? (
        <div className="text-center py-12 px-0 text-gray-400 text-[13px]">
          <RefreshCw size={28} className="mx-auto mb-2 block animate-spin" />
          Memuat data transaksi...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4 text-gray-400 flex flex-col items-center gap-2">
          <InboxIcon size={48} color="#9ca3af" />
          <p className="text-[14px] font-semibold text-gray-700 m-0">Tidak ada transaksi</p>
          <span className="text-[12px]">
            {filter === "pending"
              ? "Semua bukti bayar sudah ditangani."
              : `Tidak ada data dengan status "${filter}".`}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((trx) => (
            <div key={trx.id_transaksi} className="bg-white dark:bg-[#1a2640] rounded-2xl border border-gray-100 dark:border-slate-800/80 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              {/* Card Header */}
              <div className="flex justify-between items-center p-[14px_16px_10px] border-b border-dashed border-gray-100">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{trx.id_user}</span>
                  <span className="text-[11px] text-gray-400">
                    {timeAgo(trx.timestamp)}
                  </span>
                </div>
                <span className={`text-[10px] font-bold p-[3px_10px] rounded-full ${
                  trx.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                  trx.status === 'verified' ? 'bg-green-100 text-green-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {trx.status === "pending"
                    ? "⏳ Menunggu"
                    : trx.status === "verified"
                      ? "✅ Terverifikasi"
                      : "❌ Ditolak"}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-[12px_16px]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase">Keterangan</span>
                  <span className="text-[13px] font-semibold text-gray-700">{trx.keterangan || "-"}</span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase">Nominal</span>
                  <span className="text-[16px] font-extrabold text-green-600">
                    {formatRp(trx.nominal)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase">Jenis</span>
                  <span className="text-[13px] font-semibold text-gray-700 capitalize">
                    {trx.jenis}
                  </span>
                </div>

                {/* Bukti foto */}
                <div className="my-2.5 rounded-[10px] overflow-hidden border border-gray-200 bg-gray-50 max-h-[180px] flex items-center justify-center">
                  {trx.url_bukti ? (
                    <img
                      src={getDriveImgUrl(trx.url_bukti)}
                      alt="Bukti Pembayaran"
                      className="w-full max-h-[180px] object-cover block"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="text-[11px] text-gray-400 p-6 text-center flex-col items-center justify-center w-full"
                    style={{ display: trx.url_bukti ? "none" : "flex" }}
                  >
                    <ImageOff size={24} className="mx-auto mb-1.5 block text-gray-300" />
                    <span>Tidak ada bukti foto</span>
                    {trx.url_bukti && (
                      <a href={trx.url_bukti} target="_blank" rel="noreferrer" className="text-blue-500 mt-2 underline break-all">
                        Buka Link Manual
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons — only show for pending */}
              {trx.status === "pending" && (
                <div className="grid grid-cols-2 gap-2 p-[0_16px_14px]">
                  <button
                    className="p-2.5 rounded-[10px] border-none text-[13px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-green-100 text-green-800 hover:bg-green-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={processingId === trx.id_transaksi}
                    onClick={() => handleAction(trx, "verify")}
                  >
                    <CheckCircle2 size={16} />
                    {processingId === trx.id_transaksi ? "Memproses..." : "Setujui"}
                  </button>
                  <button
                    className="p-2.5 rounded-[10px] border-none text-[13px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-red-100 text-red-800 hover:bg-red-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={processingId === trx.id_transaksi}
                    onClick={() => handleAction(trx, "reject")}
                  >
                    <XCircle size={16} />
                    Tolak
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
