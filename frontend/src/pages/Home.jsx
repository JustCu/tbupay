import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import {
  Wallet,
  Bell,
  AlertCircle,
  CheckCircle,
  ClipboardCheck,
  ChevronRight,
  ChevronLeft,
  Users,
  Newspaper,
  CalendarDays,
  X,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  MessageSquareWarning,
  Landmark,
  Lightbulb,
  MessageCircle,
} from "lucide-react";
import { getTransactions } from "../application/use-cases/transactions/transactionUseCases";
import { getNews } from "../application/use-cases/news/newsUseCases";
import { getUsers } from "../application/use-cases/users/userUseCases";
import { getTickets } from "../application/use-cases/tickets/ticketUseCases";
import NotificationModal from "../components/NotificationModal";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import usePullToRefresh from "../hooks/usePullToRefresh";

// ── News Detail Bottom Sheet ───────────────────────────────────────────────
function NewsDetailSheet({ news, onClose }) {
  const isOpen = !!news;

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const formatDate = (str) => {
    if (!str) return "";
    return new Date(str).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div
      className={`fixed inset-0 z-[200] flex justify-center items-end transition-all duration-300 ${
        isOpen ? "bg-black/50 pointer-events-auto" : "bg-transparent pointer-events-none"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-[24px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "85dvh" }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-0 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-[#0f4c81]">
              <Newspaper size={16} />
            </div>
            <span className="text-[11px] font-bold text-[#0f4c81] uppercase tracking-wider">
              Berita Perumahan
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border-none cursor-pointer text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Date */}
          <div className="flex items-center gap-1.5 text-gray-400">
            <CalendarDays size={13} />
            <span className="text-[12px] font-medium">{formatDate(news?.tanggal)}</span>
          </div>

          {/* Title */}
          <h2 className="text-gray-900 font-bold leading-snug m-0" style={{ fontSize: "18px" }}>
            {news?.judul}
          </h2>

          {/* Content */}
          <p className="text-gray-600 dark:text-gray-300 text-[14px] leading-relaxed m-0 whitespace-pre-line pb-8">
            {news?.konten}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── All Transactions Bottom Sheet ───────────────────────────────────────────
function AllTransactionsSheet({ transactions, isOpen, onClose, formatRupiah }) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex justify-center items-end transition-all duration-300 ${
        isOpen ? "bg-black/50 pointer-events-auto" : "bg-transparent pointer-events-none"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-[24px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "85dvh", height: "85dvh" }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-0 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800/80 shrink-0">
          <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100 m-0">Semua Riwayat Transaksi</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border-none cursor-pointer text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-0 py-0 flex flex-col pb-8 flex-1">
          {transactions.length > 0 ? (
            transactions.map((trx, index) => {
              const isPemasukan = trx.jenis === "pemasukan";
              const statusLabel =
                trx.status === "verified"
                  ? "Terverifikasi"
                  : trx.status === "pending"
                    ? "Menunggu Verifikasi"
                    : "Ditolak";

              return (
                <div key={trx.id_transaksi} className={`flex items-center justify-between gap-2.5 p-4 ${index !== transactions.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-slate-50 transition-colors`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPemasukan ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                      {isPemasukan ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-gray-800 leading-snug m-0 truncate">
                        {trx.keterangan || "-"}
                      </p>
                      <p className="mt-0.5 text-[12px] text-gray-400 flex items-center gap-1.5 m-0">
                        {new Date(trx.timestamp).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold leading-tight ${
                          trx.status === "verified" ? "bg-green-100 text-green-800" :
                          trx.status === "pending" ? "bg-amber-100 text-amber-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {statusLabel}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold shrink-0 tabular-nums m-0 ${isPemasukan ? "text-green-500" : "text-red-500"}`}>
                    {isPemasukan ? "+" : "-"}{" "}
                    {formatRupiah(Number(trx.nominal) || 0)}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="py-12 px-6 text-center">
              <p className="text-sm font-normal text-gray-500 m-0">
                Belum ada riwayat transaksi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const NEWS_GRADIENTS = [
  "linear-gradient(135deg, #0f303f 0%, #0d5450 55%, #148f77 100%)", // Deep Ocean Teal
  "linear-gradient(135deg, #2b1b54 0%, #3e1b73 55%, #5a2e9c 100%)", // Deep Indigo Purple
  "linear-gradient(135deg, #421623 0%, #631e34 55%, #8a2e4a 100%)", // Deep Crimson Rose
];

// ── Swipeable Hero Carousel ────────────────────────────────────────────────
function HeroCarousel({ totalKas, totalPemasukan, totalPengeluaran, latestNews, loading, formatRupiah, statusIuran, onOpenNews }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  // Build slides: first = kas card, then up to 3 news cards
  const newsSlides = latestNews.slice(0, 3);
  const totalSlides = 1 + newsSlides.length;

  const goTo = (idx) => {
    setActiveIndex(Math.max(0, Math.min(idx, totalSlides - 1)));
  };

  // Auto-peek tease animation on mount
  useEffect(() => {
    if (totalSlides > 1 && activeIndex === 0) {
      const timer = setTimeout(() => {
        setActiveIndex(1);
        const timerBack = setTimeout(() => {
          setActiveIndex(0);
        }, 1000);
        return () => clearTimeout(timerBack);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [totalSlides]);

  // Touch handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > dy && Math.abs(dx) > 10) {
      isDragging.current = true;
      e.stopPropagation(); // prevent pull-to-refresh interfering
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging.current || touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -40) goTo(activeIndex + 1);
    else if (dx > 40) goTo(activeIndex - 1);
    touchStartX.current = null;
    isDragging.current = false;
  };

  const getTranslateX = () => {
    const cardWidth = 88;
    const gap = 12;
    const baseTranslate = `-${activeIndex * cardWidth}% - ${activeIndex * gap}px`;
    
    if (activeIndex === 0) {
      return `calc(${baseTranslate})`;
    } else if (activeIndex === totalSlides - 1) {
      return `calc(${baseTranslate} + 12%)`;
    } else {
      return `calc(${baseTranslate} + 6%)`;
    }
  };

  // Mouse drag (desktop)
  const mouseStartX = useRef(null);
  const handleMouseDown = (e) => { mouseStartX.current = e.clientX; };
  const handleMouseUp = (e) => {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? goTo(activeIndex + 1) : goTo(activeIndex - 1);
    mouseStartX.current = null;
  };

  const formatNewsDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <section className="flex flex-col gap-3 select-none">
      {/* Slide track */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(${getTranslateX()})`,
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: "transform",
            gap: "12px",
          }}
        >
          {/* ── Card 0: Kas Finansial ── */}
          <div className="w-[88%] shrink-0 h-[210px]">
            <div
              className="relative overflow-hidden text-white p-5 rounded-xl flex flex-col h-full"
              style={{
                background: "linear-gradient(145deg, #0a3460 0%, #0f4c81 50%, #1565a8 100%)",
              }}
            >
              {/* Background Icon */}
              <Wallet className="absolute -right-6 -bottom-6 w-40 h-40 text-white opacity-[0.07] pointer-events-none rotate-[-10deg]" />

              {/* Top label */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Wallet size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Kas Perumahan</span>
                </div>
                {/* Iuran status pill */}
                {!loading && (
                  <span
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      statusIuran === "lunas"
                        ? "bg-emerald-400/20 text-emerald-300"
                        : statusIuran === "pending"
                          ? "bg-amber-400/20 text-amber-300"
                          : "bg-red-400/20 text-red-300"
                    }`}
                  >
                    {statusIuran === "lunas" && <CheckCircle size={10} />}
                    {statusIuran !== "lunas" && <AlertCircle size={10} />}
                    {statusIuran === "lunas" ? "Iuran Lunas" : statusIuran === "pending" ? "Pending" : "Belum Bayar"}
                  </span>
                )}
              </div>

              {/* Main saldo */}
              <div className="relative z-10 flex-1 flex flex-col justify-center">
                <p className="text-slate-400 text-[11px] font-medium m-0 mb-1">Total Saldo</p>
                {loading ? (
                  <span className="inline-block w-40 h-8 bg-white/15 rounded-lg animate-pulse" />
                ) : (
                  <span
                    className="tabular-nums font-extrabold leading-none"
                    style={{ fontSize: "28px" }}
                  >
                    {formatRupiah(totalKas)}
                  </span>
                )}
              </div>

              {/* Bottom: Pendapatan | Pengeluaran */}
              <div className="relative z-10 border-t border-white/10 pt-3 grid grid-cols-2 gap-2">
                {/* Pendapatan */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <ArrowUpRight size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Pendapatan</span>
                  </div>
                  {loading ? (
                    <span className="inline-block w-24 h-4 bg-white/15 rounded animate-pulse" />
                  ) : (
                    <span className="text-emerald-300 text-[13px] font-extrabold tabular-nums">
                      {formatRupiah(totalPemasukan)}
                    </span>
                  )}
                </div>

                {/* Pengeluaran */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-rose-400">
                    <ArrowDownRight size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Pengeluaran</span>
                  </div>
                  {loading ? (
                    <span className="inline-block w-24 h-4 bg-white/15 rounded animate-pulse" />
                  ) : (
                    <span className="text-rose-300 text-[13px] font-extrabold tabular-nums">
                      {formatRupiah(totalPengeluaran)}
                    </span>
                  )}
                </div>
              </div>

              {/* Swipe visual hint */}
              {totalSlides > 1 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 p-1.5 rounded-full text-white/70 animate-pulse pointer-events-none z-20">
                  <ChevronRight size={18} className="stroke-[2.5]" />
                </div>
              )}
            </div>
          </div>

          {/* ── Cards 1-3: Berita Terkini ── */}
          {newsSlides.map((item, i) => (
            <div key={item.id_berita || i} className="w-[88%] shrink-0 h-[210px]">
              <div
                className="relative overflow-hidden rounded-xl p-5 flex flex-col h-full"
                style={{
                  background: NEWS_GRADIENTS[i % NEWS_GRADIENTS.length],
                }}
              >
                {/* Background Icon */}
                <Newspaper className="absolute -right-4 -bottom-4 w-40 h-40 text-white opacity-[0.05] pointer-events-none rotate-[5deg]" />

                {/* Swipe Left visual hint */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 p-1.5 rounded-full text-white/70 animate-pulse pointer-events-none z-20">
                  <ChevronLeft size={18} className="stroke-[2.5]" />
                </div>

                {/* Swipe Right visual hint if there are more slides */}
                {i + 2 < totalSlides && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 p-1.5 rounded-full text-white/70 animate-pulse pointer-events-none z-20">
                    <ChevronRight size={18} className="stroke-[2.5]" />
                  </div>
                )}

                {/* Badge + date */}
                <div className="relative z-10 flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1.5 bg-white/15 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                    <Newspaper size={11} />
                    BERITA TERKINI
                  </span>
                  <span className="flex items-center gap-1 text-slate-300 text-[10px] font-medium">
                    <CalendarDays size={11} />
                    {formatNewsDate(item.tanggal)}
                  </span>
                </div>

                {/* Title */}
                <h2
                  className="relative z-10 text-white font-bold leading-snug m-0 mt-2.5"
                  style={{
                    fontSize: "15px",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.judul || "Berita Perumahan"}
                </h2>

                {/* Excerpt */}
                <p
                  className="relative z-10 text-slate-300 text-[12px] leading-relaxed m-0 mt-1.5 flex-1"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.konten || ""}
                </p>

                {/* Bottom row: counter + CTA button */}
                <div className="relative z-10 flex items-center justify-between mt-3 shrink-0">
                  <span className="text-white/40 text-[10px] font-medium">
                    {i + 1} / {newsSlides.length}
                  </span>
                  <button
                    className="flex items-center gap-1 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-full border-none cursor-pointer transition-colors"
                    onClick={(e) => { e.stopPropagation(); onOpenNews(item); }}
                  >
                    Baca Selengkapnya
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {totalSlides > 1 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: activeIndex === i ? "20px" : "6px",
                  height: "6px",
                  background: activeIndex === i ? "#0f4c81" : "#cbd5e1",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main Home Component ────────────────────────────────────────────────────
export default function Home() {
  const user = useStore((state) => state.user);
  const showAlert = useStore((state) => state.showAlert);
  const showConfirm = useStore((state) => state.showConfirm);
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          return parsed.response.data;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [latestNews, setLatestNews] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getNews:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          const sorted = [...parsed.response.data].sort(
            (a, b) => new Date(b.tanggal) - new Date(a.tanggal),
          );
          return sorted.slice(0, 3);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [openTicketsCount, setOpenTicketsCount] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTickets:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          return parsed.response.data.filter((t) => t.status === "open").length;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  });

  const [totalKas, setTotalKas] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          let total = 0;
          parsed.response.data.forEach((t) => {
            if (t.status === "verified") {
              const n = parseFloat(t.nominal) || 0;
              if (t.jenis === "pemasukan") total += n;
              if (t.jenis === "pengeluaran") total -= n;
            }
          });
          return total;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  });

  const [totalPemasukan, setTotalPemasukan] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          let pemasukan = 0;
          parsed.response.data.forEach((t) => {
            if (t.status === "verified") {
              const n = parseFloat(t.nominal) || 0;
              if (t.jenis === "pemasukan") pemasukan += n;
            }
          });
          return pemasukan;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  });

  const [totalPengeluaran, setTotalPengeluaran] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.response?.status === "success" && Array.isArray(parsed.response.data)) {
          let pengeluaran = 0;
          parsed.response.data.forEach((t) => {
            if (t.status === "verified") {
              const n = parseFloat(t.nominal) || 0;
              if (t.jenis === "pengeluaran") pengeluaran += n;
            }
          });
          return pengeluaran;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cachedTrx = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      const cachedNews = localStorage.getItem("tbu_pay_cache_v1:getNews:{}");
      if (cachedTrx || cachedNews) return false;
    } catch (e) {
      console.error(e);
    }
    return true;
  });

  const [dataSource, setDataSource] = useState(() => {
    try {
      const cachedTrx = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      const cachedNews = localStorage.getItem("tbu_pay_cache_v1:getNews:{}");
      if (cachedTrx || cachedNews) return "cache";
    } catch (e) {
      console.error(e);
    }
    return "network";
  });

  const [refreshing, setRefreshing] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isAllTrxOpen, setIsAllTrxOpen] = useState(false);

  const myAllTransactions = useMemo(() => {
    return [...transactions]
      .filter((t) => t.id_user === user?.id_user)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions, user?.id_user]);

  const myLatestTransactions = useMemo(() => {
    return myAllTransactions.slice(0, 5);
  }, [myAllTransactions]);

  // Computed payment status for this month
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const myTrxThisMonth = transactions.filter((t) => {
    const d = new Date(t.timestamp);
    return (
      t.id_user === user?.id_user &&
      d.getMonth() === thisMonth &&
      d.getFullYear() === thisYear
    );
  });
  const statusIuran = myTrxThisMonth.some((t) => t.status === "verified")
    ? "lunas"
    : myTrxThisMonth.some((t) => t.status === "pending")
      ? "pending"
      : "belum_bayar";

  // Count all pending transactions (for admin quick action badge)
  const pendingCount = transactions.filter(
    (t) => t.status === "pending",
  ).length;



  const fetchData = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else {
      setLoading((prev) => {
        const hasData = transactions.length > 0 || latestNews.length > 0;
        return hasData ? false : true;
      });
    }

    try {
      const [transRes, newsRes, ticketsRes] = await Promise.all([
        getTransactions(forceRefresh ? { forceRefresh: true } : {}),
        getNews(forceRefresh ? { forceRefresh: true } : {}),
        getTickets(forceRefresh ? { forceRefresh: true } : {}),
      ]);

      if (transRes?._meta?.source) {
        setDataSource(transRes._meta.source);
      }

      if (transRes.status === "success") {
        setTransactions(transRes.data);

        let total = 0;
        let pemasukan = 0;
        let pengeluaran = 0;
        transRes.data.forEach((t) => {
          if (t.status === "verified") {
            const n = parseFloat(t.nominal) || 0;
            if (t.jenis === "pemasukan") { total += n; pemasukan += n; }
            if (t.jenis === "pengeluaran") { total -= n; pengeluaran += n; }
          }
        });
        setTotalKas(total);
        setTotalPemasukan(pemasukan);
        setTotalPengeluaran(pengeluaran);

        // Determine if there are unread notifications
        const myPending = transRes.data.filter(
          (t) => t.id_user === user?.id_user && t.status === "pending",
        );
        const myVerified = transRes.data.filter((t) => {
          const d = new Date(t.timestamp);
          return (
            t.id_user === user?.id_user &&
            d.getMonth() === thisMonth &&
            d.getFullYear() === thisYear
          );
        });
        const hasPayment = transRes.data.some((t) => {
          const d = new Date(t.timestamp);
          return (
            t.id_user === user?.id_user &&
            d.getMonth() === thisMonth &&
            d.getFullYear() === thisYear &&
            (t.status === "verified" || t.status === "pending")
          );
        });

        const hasNews = newsRes?.status === "success" && Array.isArray(newsRes.data) && newsRes.data.length > 0;

        const showBadge =
          myPending.length > 0 ||
          myVerified.length > 0 ||
          (user?.role === "warga" && !hasPayment) ||
          hasNews;
        setHasUnread(showBadge);
      }

      if (newsRes?.status === "success" && Array.isArray(newsRes.data)) {
        const sorted = [...newsRes.data].sort(
          (a, b) => new Date(b.tanggal) - new Date(a.tanggal),
        );
        setLatestNews(sorted.slice(0, 3));
      }

      if (ticketsRes?.status === "success" && Array.isArray(ticketsRes.data)) {
        const openCount = ticketsRes.data.filter((t) => t.status === "open").length;
        setOpenTicketsCount(openCount);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Safeguard: Pastikan body scroll tidak terkunci saat halaman Beranda dimuat
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);



  useEffect(() => {
    fetchData();
  }, [user]);

  const pull = usePullToRefresh({
    onRefresh: () => fetchData(true),
    disabled: loading || refreshing,
  });

  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const handleSendReminder = async () => {
    try {
      setLoading(true);
      const userRes = await getUsers({ forceRefresh: true });
      if (userRes.status !== "success") {
        showAlert("Gagal mengambil data warga.", { variant: "danger", title: "Error" });
        return;
      }
      
      const allUsers = userRes.data || [];
      const wargas = allUsers.filter((u) => u.role === "warga");
      
      const now = new Date();
      const curMonth = now.getMonth();
      const curYear = now.getFullYear();
      const monthName = now.toLocaleDateString("id-ID", { month: "long" });
      
      const paidUserIds = new Set(
        transactions
          .filter((t) => {
            const d = new Date(t.timestamp);
            return (
              d.getMonth() === curMonth &&
              d.getFullYear() === curYear &&
              (t.status === "verified" || t.status === "pending")
            );
          })
          .map((t) => t.id_user)
      );
      
      const unpaidWargas = wargas.filter((w) => !paidUserIds.has(w.id_user));
      
      if (unpaidWargas.length === 0) {
        showAlert(`Semua warga (${wargas.length}) telah membayar atau melaporkan iuran untuk bulan ${monthName} ${curYear}! Terima kasih.`, {
          variant: "success",
          title: "Semua Iuran Lunas",
        });
      } else {
        const listStr = unpaidWargas
          .map((w) => `• ${w.nama} (${w.blok_rumah})`)
          .join("\n");
          
        showConfirm(
          `Terdapat ${unpaidWargas.length} warga yang belum membayar iuran bulan ${monthName} ${curYear}:\n\n${listStr}\n\nKirimkan notifikasi pengingat pembayaran ke mereka?`,
          () => {
            showAlert(
              `Notifikasi pengingat pembayaran iuran bulan ${monthName} berhasil dikirim ke ${unpaidWargas.length} warga via WhatsApp & Notifikasi In-App!`,
              { variant: "success", title: "Pengingat Terkirim" }
            );
          },
          {
            title: "Kirim Pengingat Iuran",
            variant: "warning",
            confirmLabel: "Kirim Sekarang",
            cancelLabel: "Batal",
          }
        );
      }
    } catch (error) {
      console.error(error);
      showAlert("Terjadi kesalahan koneksi saat mengirim pengingat.", { variant: "danger", title: "Koneksi Gagal" });
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = () => {
    window.dispatchEvent(new CustomEvent("open-payment-modal"));
  };

  const getInitials = (name) => {
    if (!name) return "W";
    const words = name.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
    <div className="flex flex-col gap-6 pb-24" {...pull.bind}>
      {pull.showPullHint && (
        <div className={`sticky top-2 z-[31] mx-auto mb-2.5 w-fit px-3 py-[7px] rounded-full border text-xs font-semibold ${pull.isReady ? "border-green-300 bg-green-50 text-green-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}>
          {pull.isReady ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang"}
        </div>
      )}
      <CacheFallbackBadge source={dataSource} />
      
      {/* Header */}
      <header className="flex justify-between items-center py-1">
        <div className="flex items-center gap-3">
          {user?.url_foto_profil ? (
            <img
              src={user.url_foto_profil}
              alt="Avatar"
              className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-slate-700 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-lg font-black tracking-widest overflow-hidden shrink-0">
              {getInitials(user?.nama)}
            </div>
          )}
          <div className="flex flex-col justify-center">
            <span className="text-[13px] font-medium text-gray-400 leading-tight">Welcome Back,</span>
            <h2 className="text-[20px] font-extrabold text-gray-900 dark:text-gray-100 m-0 leading-tight">
              {user?.nama || "Warga"}!
            </h2>
          </div>
        </div>
        <div
          className="cursor-pointer relative transition-all duration-200 flex items-center justify-center p-2 text-gray-700 hover:text-gray-950 active:scale-95"
          onClick={() => {
            setIsNotifOpen(true);
            setHasUnread(false);
          }}
        >
          <Bell size={24} className={`stroke-[1.75] transition-colors duration-500 ${!loading ? "fill-amber-400 text-amber-500" : ""}`} />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border border-white rounded-full animate-pulse z-10"></span>
          )}
        </div>
      </header>

      {/* ── Swipeable Hero Carousel ── */}
      <HeroCarousel
        totalKas={totalKas}
        totalPemasukan={totalPemasukan}
        totalPengeluaran={totalPengeluaran}
        latestNews={latestNews}
        loading={loading}
        formatRupiah={formatRupiah}
        statusIuran={statusIuran}
        onOpenNews={setSelectedNews}
      />
      {/* ── Quick Actions ── */}
      <section className="grid grid-cols-4 gap-3">
        <button
          className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer"
          onClick={() => navigate("/admin/users")}
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Data Warga</span>
        </button>
        <button
          className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer"
          onClick={() => navigate("/service", { state: { openSheet: "saran" } })}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Lightbulb size={22} />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Kotak Saran</span>
        </button>
        <button
          className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer"
          onClick={() => navigate("/service", { state: { openSheet: "grupchat" } })}
        >
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex items-center justify-center shrink-0">
            <MessageCircle size={22} />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Grup Chat</span>
        </button>
        <button
          className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer"
          onClick={() => navigate("/service", { state: { openSheet: "keluhan" } })}
        >
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 flex items-center justify-center shrink-0">
            <MessageSquareWarning size={22} />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Pengaduan</span>
        </button>

        {/* Admin Specific Quick Actions */}
        {user?.role === "admin" && (
          <>
            <button
              className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer relative"
              onClick={() => navigate("/admin/verifikasi")}
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ClipboardCheck size={22} />
              </div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Verifikasi</span>
              {pendingCount > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border border-white">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer relative"
              onClick={() => navigate("/service", { state: { openSheet: "pantauan" } })}
            >
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex items-center justify-center shrink-0">
                <MessageSquareWarning size={22} />
              </div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Keluhan</span>
              {openTicketsCount > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border border-white">
                  {openTicketsCount}
                </span>
              )}
            </button>

            <button
              className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer"
              onClick={() => navigate("/service", { state: { openSheet: "berita" } })}
            >
              <div className="w-12 h-12 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400 flex items-center justify-center shrink-0">
                <Newspaper size={22} />
              </div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Tambah Berita</span>
            </button>

            <button
              className="flex flex-col items-center justify-start gap-2 bg-white dark:bg-[#1a2640] p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-none active:scale-95 transition-transform cursor-pointer"
              onClick={handleSendReminder}
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Bell size={22} />
              </div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 text-center leading-tight">Kirim Pengingat</span>
            </button>
          </>
        )}
      </section>





      {/* Quick Info Slider */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold m-0">Riwayat Transaksi Terakhir</h3>
          <button
            onClick={() => setIsAllTrxOpen(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded-full border-none cursor-pointer active:scale-95 transition-all"
          >
            Lihat Semua
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="bg-white dark:bg-[#131c33] border border-gray-200 dark:border-slate-800/80 rounded-xl overflow-hidden">
          {myLatestTransactions.length > 0 ? (
            <div className="flex flex-col">
              {myLatestTransactions.map((trx, index) => {
                const isPemasukan = trx.jenis === "pemasukan";
                const statusLabel =
                  trx.status === "verified"
                    ? "Terverifikasi"
                    : trx.status === "pending"
                      ? "Menunggu Verifikasi"
                      : "Ditolak";
                
                return (
                  <div key={trx.id_transaksi} className={`flex items-center justify-between gap-2.5 p-3.5 ${index !== myLatestTransactions.length - 1 ? 'border-b border-gray-100' : ''} transition-colors hover:bg-slate-50`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7.5 h-7.5 min-w-[30px] rounded-full flex items-center justify-center shrink-0 ${isPemasukan ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                        {isPemasukan ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 leading-snug m-0 truncate">
                          {trx.keterangan || "-"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400 flex items-center gap-1.5 m-0">
                          {new Date(trx.timestamp).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold leading-tight ${
                            trx.status === "verified" ? "bg-green-100 text-green-800" :
                            trx.status === "pending" ? "bg-amber-100 text-amber-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {statusLabel}
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs font-bold shrink-0 tabular-nums m-0 ${isPemasukan ? "text-green-500" : "text-red-500"}`}>
                      {isPemasukan ? "+" : "-"}{" "}
                      {formatRupiah(Number(trx.nominal) || 0)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4.5 px-3.5 text-center">
              <p className="text-sm font-normal text-gray-500 m-0">
                {loading
                  ? "Memuat riwayat transaksi..."
                  : "Belum ada riwayat transaksi."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onPayNow={handlePayNow}
      />
    </div>

    {/* News Detail Bottom Sheet — rendered outside scroll container */}
    <NewsDetailSheet
      news={selectedNews}
      onClose={() => setSelectedNews(null)}
    />

    {/* All Transactions Bottom Sheet */}
    <AllTransactionsSheet
      transactions={myAllTransactions}
      isOpen={isAllTrxOpen}
      onClose={() => setIsAllTrxOpen(false)}
      formatRupiah={formatRupiah}
    />
    </>
  );
}
