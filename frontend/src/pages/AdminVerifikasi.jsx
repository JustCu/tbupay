import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  X,
  Clock,
  ImageOff,
  ShieldCheck,
  InboxIcon,
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Users,
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from "lucide-react";
import {
  getTransactions,
  verifyTransaction,
} from "../application/use-cases/transactions/transactionUseCases";
import { getUsers } from "../application/use-cases/users/userUseCases";
import useStore from "../store/useStore";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import usePullToRefresh from "../hooks/usePullToRefresh";


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

/** Generate formatted WhatsApp link with polite reminder */
function formatWhatsAppUrl(phone, name, monthName) {
  if (!phone) return "";
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "62" + cleanPhone.slice(1);
  }
  const message = `Halo Bapak/Ibu ${name}, sekadar mengingatkan untuk melakukan pembayaran iuran warga bulan ${monthName}. Silakan lakukan pembayaran melalui aplikasi TBU Pay. Terima kasih banyak 🙏`;
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
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
  const [showPaidList, setShowPaidList] = useState(false);

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
  const [previewImgUrl, setPreviewImgUrl] = useState(null);

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

  const userNameMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      if (u.id_user && u.nama) {
        map.set(String(u.id_user), u.nama);
      }
    });
    return map;
  }, [users]);

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

      {/* Stats Dashboard Grid (2x2) */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Card: Menunggu */}
        <div
          className={`bg-white dark:bg-[#1a2640] rounded-[16px] p-3.5 border cursor-pointer transition-all duration-250 flex flex-col justify-between h-[82px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 active:scale-[0.98] select-none ${
            filter === "pending"
              ? "border-amber-400 dark:border-amber-500 bg-amber-50/20 dark:bg-amber-950/10 shadow-[0_4px_12px_rgba(245,158,11,0.08)] ring-1 ring-amber-400/40"
              : "border-gray-100 dark:border-slate-800/80 hover:shadow-sm"
          }`}
          onClick={() => setFilter("pending")}
        >
          <div className="flex justify-between items-center w-full">
            <div className={`p-1.5 rounded-lg transition-colors ${
              filter === "pending"
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500"
            }`}>
              <Clock size={16} />
            </div>
            <span className={`text-[20px] font-black leading-none ${
              filter === "pending"
                ? "text-amber-500"
                : "text-gray-800 dark:text-gray-200"
            }`}>{pendingCount}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
            Menunggu
          </div>
        </div>

        {/* Card: Belum Bayar */}
        <div
          className={`bg-white dark:bg-[#1a2640] rounded-[16px] p-3.5 border cursor-pointer transition-all duration-250 flex flex-col justify-between h-[82px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 active:scale-[0.98] select-none ${
            filter === "belum_bayar"
              ? "border-red-400 dark:border-red-500 bg-red-50/20 dark:bg-red-950/10 shadow-[0_4px_12px_rgba(239,68,68,0.08)] ring-1 ring-red-400/40"
              : "border-gray-100 dark:border-slate-800/80 hover:shadow-sm"
          }`}
          onClick={() => setFilter("belum_bayar")}
        >
          <div className="flex justify-between items-center w-full">
            <div className={`p-1.5 rounded-lg transition-colors ${
              filter === "belum_bayar"
                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                : "bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500"
            }`}>
              <AlertCircle size={16} />
            </div>
            <span className={`text-[20px] font-black leading-none ${
              filter === "belum_bayar"
                ? "text-red-500"
                : "text-gray-800 dark:text-gray-200"
            }`}>{unpaidList.length}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
            Belum Bayar
          </div>
        </div>

        {/* Card: Terverifikasi */}
        <div
          className={`bg-white dark:bg-[#1a2640] rounded-[16px] p-3.5 border cursor-pointer transition-all duration-250 flex flex-col justify-between h-[82px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 active:scale-[0.98] select-none ${
            filter === "verified"
              ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-[0_4px_12px_rgba(16,185,129,0.08)] ring-1 ring-emerald-400/40"
              : "border-gray-100 dark:border-slate-800/80 hover:shadow-sm"
          }`}
          onClick={() => setFilter("verified")}
        >
          <div className="flex justify-between items-center w-full">
            <div className={`p-1.5 rounded-lg transition-colors ${
              filter === "verified"
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500"
            }`}>
              <CheckCircle2 size={16} />
            </div>
            <span className={`text-[20px] font-black leading-none ${
              filter === "verified"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-800 dark:text-gray-200"
            }`}>{verifiedCount}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
            Terverifikasi
          </div>
        </div>

        {/* Card: Ditolak */}
        <div
          className={`bg-white dark:bg-[#1a2640] rounded-[16px] p-3.5 border cursor-pointer transition-all duration-250 flex flex-col justify-between h-[82px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 active:scale-[0.98] select-none ${
            filter === "rejected"
              ? "border-slate-400 dark:border-slate-550 bg-slate-50/20 dark:bg-slate-900/25 shadow-[0_4px_12px_rgba(100,116,139,0.08)] ring-1 ring-slate-400/40"
              : "border-gray-100 dark:border-slate-800/80 hover:shadow-sm"
          }`}
          onClick={() => setFilter("rejected")}
        >
          <div className="flex justify-between items-center w-full">
            <div className={`p-1.5 rounded-lg transition-colors ${
              filter === "rejected"
                ? "bg-slate-500/20 text-slate-600 dark:text-slate-400"
                : "bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500"
            }`}>
              <XCircle size={16} />
            </div>
            <span className={`text-[20px] font-black leading-none ${
              filter === "rejected"
                ? "text-red-500 dark:text-red-400"
                : "text-gray-800 dark:text-gray-200"
            }`}>{rejectedCount}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
            Ditolak
          </div>
        </div>
      </div>

      {/* ── Tab: Belum Bayar ── */}
      {filter === "belum_bayar" ? (
        <div className="flex flex-col gap-4">
          {/* Bulan Penagihan Picker */}
          <div className="bg-white dark:bg-[#1a2640] rounded-2xl border border-gray-100 dark:border-slate-800/80 p-4 shadow-sm">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pilih Bulan Penagihan</label>
            <div className="relative">
              <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="month"
                className="w-full border border-gray-200 dark:border-[#2c3c5e] rounded-xl pl-10 pr-4 py-3 text-[13px] font-semibold bg-gray-50 dark:bg-[#1b2641] text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 appearance-none cursor-pointer"
                value={unpaidMonth}
                onChange={(e) => {
                  setUnpaidMonth(e.target.value);
                  setShowPaidList(false);
                }}
              />
            </div>
          </div>

          {/* Summary Alert Banner */}
          {!loading && !loadingUsers && (
            <div className={`flex items-center gap-3.5 rounded-2xl p-4 border transition-all duration-200 shadow-sm ${
              unpaidList.length === 0
                ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/10 dark:to-teal-950/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400"
                : "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/10 dark:to-rose-950/10 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-400"
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                unpaidList.length === 0 ? "bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              }`}>
                {unpaidList.length === 0
                  ? <CheckCircle size={20} />
                  : <AlertCircle size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold m-0 leading-tight">
                  {unpaidList.length === 0
                    ? `Semua warga sudah bayar ${formatBulan(unpaidMonth)}`
                    : `${unpaidList.length} dari ${unpaidList.length + paidList.length} warga belum bayar`}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 m-0 mt-1 leading-none">
                  Bulan penagihan: <span className="font-bold">{formatBulan(unpaidMonth)}</span>
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
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-extrabold text-gray-400 dark:text-slate-450 uppercase tracking-wider m-0 px-1">Belum Bayar ({unpaidList.length})</p>
              {unpaidList.map(({ user: u }) => {
                const waUrl = formatWhatsAppUrl(u.no_hp, u.nama, formatBulan(unpaidMonth));
                return (
                  <div
                    key={u.id_user}
                    className="bg-white dark:bg-[#1a2640] rounded-2xl border border-red-50 dark:border-red-950/20 p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {/* Initials Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500/10 to-rose-500/10 dark:from-red-500/10 dark:to-rose-500/5 flex items-center justify-center text-[14px] font-black text-red-600 dark:text-red-400 border border-red-100/60 dark:border-red-900/20 shrink-0">
                      {u.nama?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-gray-800 dark:text-gray-150 truncate leading-tight">{u.nama}</div>
                      <div className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap leading-none">
                        <span className="font-bold text-gray-500 dark:text-slate-300 bg-gray-100 dark:bg-slate-800/80 p-[2.5px_6px] rounded-md text-[10px]">{u.blok_rumah}</span>
                        {u.no_hp && <span className="text-[10px] text-gray-400">{u.no_hp}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-sm"
                          title="Ingatkan via WhatsApp"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      <span className="text-[10px] font-extrabold bg-red-55/70 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2.5 py-1.5 rounded-full border border-red-100/50 dark:border-red-950/20">
                        Belum Bayar
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Daftar Sudah Bayar (Collapsible) */}
          {!loading && !loadingUsers && paidList.length > 0 && (
            <div className="flex flex-col gap-2.5 mt-2">
              {/* Trigger Toggle */}
              <div
                className="bg-white dark:bg-[#1a2640] rounded-2xl border border-gray-100 dark:border-slate-800/80 p-4 flex justify-between items-center cursor-pointer shadow-sm hover:shadow transition-all duration-200 select-none"
                onClick={() => setShowPaidList(!showPaidList)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle size={13} />
                  </div>
                  <span className="text-[12.5px] font-bold text-gray-700 dark:text-gray-200">
                    Warga Sudah Bayar ({paidList.length})
                  </span>
                </div>
                <div className={`text-gray-400 transition-transform duration-350 ${showPaidList ? "rotate-180" : ""}`}>
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Collapsed Content */}
              {showPaidList && (
                <div className="flex flex-col gap-2.5 mt-1 animate-[fadeIn_0.2s_ease-out]">
                  {paidList.map(({ user: u, trx }) => (
                    <div
                      key={u.id_user}
                      className="bg-white dark:bg-[#1a2640] rounded-2xl border border-emerald-50 dark:border-emerald-950/20 p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      {/* Initials Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/10 dark:to-teal-500/5 flex items-center justify-center text-[14px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/20 shrink-0">
                        {u.nama?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold text-gray-800 dark:text-gray-150 truncate leading-tight">{u.nama}</div>
                        <div className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap leading-none">
                          <span className="font-bold text-gray-500 dark:text-slate-300 bg-gray-100 dark:bg-slate-800/80 p-[2.5px_6px] rounded-md text-[10px]">{u.blok_rumah}</span>
                          {trx && (
                            <span className={`text-[10px] font-bold ${
                              trx.status === "verified" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"
                            }`}>
                              · {trx.status === "verified" ? "✅ Terverifikasi" : "⏳ Menunggu verif"}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Badge */}
                      <span className="text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-full border border-emerald-100/50 dark:border-emerald-950/20 shrink-0">
                        Sudah Bayar
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                  <span className="text-[14px] font-bold text-gray-800 dark:text-gray-100">
                    {userNameMap.get(String(trx.id_user)) || trx.id_user}
                  </span>
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
                <div 
                  className={`my-2.5 rounded-[10px] overflow-hidden border border-gray-200 bg-gray-50 max-h-[180px] flex items-center justify-center ${trx.url_bukti ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
                  onClick={() => {
                    if (trx.url_bukti) {
                      setPreviewImgUrl(getDriveImgUrl(trx.url_bukti));
                    }
                  }}
                >
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

      {/* Fullscreen Image Preview Modal */}
      {previewImgUrl && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 backdrop-blur-[2px] p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setPreviewImgUrl(null)}
        >
          {/* Top-right Floating Close Button with Safe Area Support for iOS/Notch */}
          <button
            type="button"
            className="fixed top-[calc(12px+env(safe-area-inset-top,0px))] right-4 z-[251] w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center border border-white/10 cursor-pointer active:scale-95 transition-all"
            onClick={() => setPreviewImgUrl(null)}
            aria-label="Tutup pratinjau"
          >
            <X size={20} className="stroke-[2.5]" />
          </button>
 
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <img
              src={previewImgUrl}
              alt="Pratinjau Bukti Pembayaran"
              className="max-w-full max-h-[80dvh] object-contain rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] select-none pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
