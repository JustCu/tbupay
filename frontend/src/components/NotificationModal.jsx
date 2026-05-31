import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Bell,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  BellOff,
} from "lucide-react";
import { getTransactions } from "../application/use-cases/transactions/transactionUseCases";
import { getNews } from "../application/use-cases/news/newsUseCases";
import CacheFallbackBadge from "./CacheFallbackBadge";
import useStore from "../store/useStore";

const safeDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (typeof dateVal === 'string') return new Date(dateVal.replace(" ", "T"));
  return new Date(dateVal);
};

/**
 * Builds a notification list dynamically from:
 * 1. Unverified transactions (pending bukti bayar) → tipe "warning"
 * 2. Transactions that were recently verified → tipe "success"
 * 3. News/announcements from admin → tipe "info"
 * 4. Static: reminder iuran if no payment this month → tipe "danger"
 */
function buildNotifications(transactions, news, user) {
  const notifs = [];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // --- 1. Pending / belum terverifikasi dari user ini ---
  const myPendingTrx = transactions.filter(
    (t) => t.id_user === user?.id_user && t.status === "pending",
  );
  myPendingTrx.forEach((t) => {
    notifs.push({
      id: `pending-${t.id_transaksi}`,
      type: "warning",
      title: "Menunggu Verifikasi",
      body: `Bukti bayar untuk "${t.keterangan}" sebesar ${formatRp(t.nominal)} sedang menunggu konfirmasi dari Admin.`,
      time: timeAgo(t.timestamp),
      read: false,
      icon: "clock",
    });
  });

  // --- 1.5. Transaksi belum terverifikasi milik user lain (untuk Admin) ---
  const unverifiedOthers = transactions.filter((t) => {
    return t.id_user !== user?.id_user && t.status === "pending";
  });

  if (user?.role === "admin") {
    unverifiedOthers.forEach((t) => {
      notifs.push({
        id: `admin-pending-${t.id_transaksi}`,
        type: "warning",
        title: "Perlu Verifikasi",
        body: `Pembayaran iuran warga sebesar ${formatRp(t.nominal)} untuk "${t.keterangan}" menunggu verifikasi Anda.`,
        time: timeAgo(t.timestamp),
        read: false,
        icon: "alert",
        action: { label: "Verifikasi Sekarang", type: "info", key: "verify" },
      });
    });
  }

  // --- 2. Transaksi diverifikasi bulan ini (milik user) ---
  const myVerifiedTrx = transactions.filter((t) => {
    const d = safeDate(t.timestamp);
    return (
      t.id_user === user?.id_user &&
      t.status === "verified" &&
      d.getMonth() === thisMonth &&
      d.getFullYear() === thisYear
    );
  });
  if (myVerifiedTrx.length > 0) {
    const last = myVerifiedTrx[0];
    notifs.push({
      id: `verified-${last.id_transaksi}`,
      type: "success",
      title: "Pembayaran Dikonfirmasi ✓",
      body: `Bukti bayar "${last.keterangan}" sebesar ${formatRp(last.nominal)} telah diverifikasi oleh Admin.`,
      time: timeAgo(last.timestamp),
      read: false,
      icon: "check",
    });
  }

  // --- 3. Cek apakah user belum bayar iuran bulan ini (warga only) ---
  if (user?.role === "warga") {
    const hasPaymentThisMonth = transactions.some((t) => {
      const d = safeDate(t.timestamp);
      return (
        t.id_user === user?.id_user &&
        d.getMonth() === thisMonth &&
        d.getFullYear() === thisYear &&
        (t.status === "verified" || t.status === "pending")
      );
    });

    if (!hasPaymentThisMonth) {
      const monthName = now.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      notifs.push({
        id: "reminder-iuran",
        type: "danger",
        title: "Tagihan Belum Dibayar",
        body: `Iuran bulan ${monthName} belum tercatat. Harap segera kirim bukti pembayaran Anda.`,
        time: "Hari ini",
        read: false,
        icon: "alert",
        action: { label: "Bayar Sekarang", type: "danger", key: "pay" },
      });
    }
  }

  // --- 4. Berita / pengumuman admin (terbaru 3) ---
  const latestNews = [...news]
    .sort((a, b) => safeDate(b.tanggal) - safeDate(a.tanggal))
    .slice(0, 3);
  latestNews.forEach((n, idx) => {
    notifs.push({
      id: `news-${n.id_berita || idx}`,
      type: "info",
      title: n.judul || "Pengumuman Admin",
      body:
        n.isi ||
        n.konten ||
        "Silakan cek halaman layanan untuk informasi lengkap.",
      time: n.tanggal ? timeAgo(n.tanggal) : "Baru saja",
      read: idx > 0, // hanya yang pertama dianggap belum dibaca
      icon: "shield",
    });
  });

  return notifs;
}

function formatRp(nominal) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(nominal);
}

function timeAgo(dateStr) {
  const date = safeDate(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (isNaN(date.getTime())) return "";
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

const TypeIcon = ({ icon, type }) => {
  const colorMap = {
    danger: "text-red-500",
    warning: "text-amber-500",
    success: "text-green-500",
    info: "text-blue-500",
  };
  const cls = colorMap[type] || "text-gray-500";

  if (icon === "shield") return <ShieldCheck size={16} className={cls} />;
  if (icon === "check") return <CheckCircle size={16} className={cls} />;
  if (icon === "alert") return <AlertTriangle size={16} className={cls} />;
  if (icon === "clock") return <Clock size={16} className={cls} />;
  return <Bell size={16} className={cls} />;
};

export default function NotificationModal({ isOpen, onClose, onPayNow }) {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState(new Set());
  const [dataSource, setDataSource] = useState("network");

  // Disable body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([getTransactions(), getNews()])
      .then(([trxRes, newsRes]) => {
        const sourceA = trxRes?._meta?.source;
        const sourceB = newsRes?._meta?.source;
        const hasFallback =
          sourceA === "cache-fallback" || sourceB === "cache-fallback";
        const hasCache = sourceA === "cache" || sourceB === "cache";

        if (hasFallback) setDataSource("cache-fallback");
        else if (hasCache) setDataSource("cache");
        else setDataSource("network");

        const trx = trxRes.status === "success" ? trxRes.data : [];
        const news = newsRes.status === "success" ? newsRes.data : [];
        setNotifications(buildNotifications(trx, news, user));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, user]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const markRead = (id) => setReadIds((prev) => new Set([...prev, id]));

  const unreadCount = notifications.filter(
    (n) => !n.read && !readIds.has(n.id),
  ).length;

  const handleAction = (notif) => {
    markRead(notif.id);
    if (notif.action?.key === "pay") {
      onClose();
      if (onPayNow) onPayNow();
    } else if (notif.action?.key === "verify") {
      onClose();
      navigate("/admin/verifikasi");
    }
  };

  const getUnreadClasses = (type) => {
    switch (type) {
      case "danger": return "border-red-200 border-l-4 border-l-red-500";
      case "warning": return "border-amber-200 border-l-4 border-l-amber-500";
      case "info": return "border-blue-200 border-l-4 border-l-blue-500";
      case "success": return "border-green-200 border-l-4 border-l-green-500";
      default: return "";
    }
  };

  const getActionBtnClasses = (type) => {
    switch (type) {
      case "danger": return "bg-red-100 text-red-600 hover:bg-red-200";
      case "info": return "bg-blue-100 text-blue-600 hover:bg-blue-200";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[999] flex justify-center items-end transition-colors duration-300 ${
        isOpen ? "bg-black/50 pointer-events-auto" : "bg-transparent pointer-events-none"
      }`}
      onClick={handleOverlayClick}
    >
      <div 
        className="w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-3xl h-[75vh] flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(calc(100% + 80px))",
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 m-0">Notifikasi</h3>
            {unreadCount > 0 && (
              <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount} Baru
              </span>
            )}
          </div>
          <button 
            className="p-2 bg-gray-100 dark:bg-slate-800/60 rounded-full text-gray-600 dark:text-gray-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-gray-200 dark:hover:bg-slate-700/60" 
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-[#0b1020] flex flex-col gap-3">
          <CacheFallbackBadge source={dataSource} />
          
          {loading && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400 text-[13px] p-10 text-center">
              <Bell size={32} />
              <span>Memuat notifikasi...</span>
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400 text-[13px] p-10 text-center">
              <BellOff size={40} />
              <p className="font-semibold text-gray-700 m-0">
                Tidak ada notifikasi
              </p>
              <p className="m-0">Semua transaksi dan tagihan Anda dalam kondisi baik.</p>
            </div>
          )}

          {!loading &&
            notifications.map((notif) => {
              const isRead = notif.read || readIds.has(notif.id);
              return (
                <div
                  key={notif.id}
                  className={`bg-white dark:bg-[#1a2640] p-4 rounded-xl border border-gray-100 dark:border-slate-700/60 shadow-sm transition-opacity duration-200 ${
                    isRead ? "opacity-55" : getUnreadClasses(notif.type)
                  }`}
                  onClick={() => markRead(notif.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5">
                      <TypeIcon icon={notif.icon} type={notif.type} />
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 m-0">{notif.title}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{notif.time}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-1 mb-0">{notif.body}</p>
                  {notif.action && (
                    <button
                      className={`inline-flex items-center gap-1 mt-2.5 text-xs font-bold py-1.5 px-3.5 rounded-lg border-none cursor-pointer transition-colors ${getActionBtnClasses(notif.action.type)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(notif);
                      }}
                    >
                      {notif.action.label}
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
