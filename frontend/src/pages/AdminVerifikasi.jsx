import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ImageOff,
  ShieldCheck,
  InboxIcon,
} from "lucide-react";
import {
  getTransactions,
  verifyTransaction,
} from "../application/use-cases/transactions/transactionUseCases";
import useStore from "../store/useStore";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import usePullToRefresh from "../hooks/usePullToRefresh";

const FILTERS = [
  { key: "pending", label: "Menunggu" },
  { key: "all", label: "Semua" },
  { key: "verified", label: "Terverifikasi" },
  { key: "rejected", label: "Ditolak" },
];

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
        const res = await getTransactions(
          forceRefresh ? { forceRefresh: true } : {},
        );
        if (res?._meta?.source) {
          setDataSource(res._meta.source);
        }
        if (res.status === "success") {
          const sorted = [...res.data].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          );
          setTransactions(sorted);

          const map = {};
          sorted.forEach((t) => {
            if (!map[t.id_user]) map[t.id_user] = t.id_user;
          });
          setUserMap(map);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  const pendingCount = transactions.filter(
    (t) => t.status === "pending",
  ).length;
  const verifiedCount = transactions.filter(
    (t) => t.status === "verified",
  ).length;
  const rejectedCount = transactions.filter(
    (t) => t.status === "rejected",
  ).length;

  // Filtered list
  const filtered =
    filter === "all"
      ? transactions
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
            Tinjau bukti bayar warga
          </p>
        </div>
        <button
          className="flex items-center gap-1 bg-gray-100 border-none p-[6px_10px] rounded-lg cursor-pointer text-gray-500 text-[12px] font-semibold transition-colors hover:bg-gray-200"
          onClick={() => fetchData(true, true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Memuat..." : "Refresh"}
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
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 px-0 text-gray-400 text-[13px]">
          <RefreshCw
            size={28}
            className="mx-auto mb-2 block animate-spin"
          />
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
                  <span
                    className="text-[13px] font-semibold text-gray-700 capitalize"
                  >
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
                    <ImageOff
                      size={24}
                      className="mx-auto mb-1.5 block text-gray-300"
                    />
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
                    {processingId === trx.id_transaksi
                      ? "Memproses..."
                      : "Setujui"}
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
      )}
    </div>
  );
}
