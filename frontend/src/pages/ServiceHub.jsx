import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import useStore from "../store/useStore";
import {
  MessageSquareWarning,
  Lightbulb,
  Newspaper,
  ClipboardList,
  X,
  MessageCircle,
  Send,
  Clock3,
  ChevronRight,
  RefreshCw,
  CalendarDays,
  CheckCircle,
  Bell,
} from "lucide-react";
import {
  getTickets,
  createTicket,
  updateTicketStatus,
  getTicketReplies,
  createTicketReply,
} from "../application/use-cases/tickets/ticketUseCases";
import {
  getNews,
  createNews,
  getNewsReplies,
  createNewsReply,
} from "../application/use-cases/news/newsUseCases";
import {
  getGeneralChats,
  createGeneralChat,
} from "../application/use-cases/chats/chatUseCases";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import NotificationModal from "../components/NotificationModal";
import usePullToRefresh from "../hooks/usePullToRefresh";

// ---------- Reusable Bottom Sheet Wrapper ----------
function BottomSheet({ isOpen, onClose, title, children, heightClass = "h-[82vh]" }) {
  return (
    <div
      className={`fixed inset-0 z-[70] flex justify-center items-end transition-colors duration-300 ${
        isOpen ? "bg-black/50 pointer-events-auto" : "bg-transparent pointer-events-none"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-[28px] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${heightClass} ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="w-[44px] h-[5px] rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mt-3 mb-1 shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-800/80 shrink-0">
          <h3 className="m-0 text-[17px] font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button
            className="p-2 bg-gray-100 dark:bg-slate-800/60 rounded-full text-gray-600 dark:text-gray-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-gray-200 dark:hover:bg-slate-700/60"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers for WhatsApp Style Chat ----------
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};

const getDeterministicColor = (name) => {
  if (!name) return "#4f46e5";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  // Ensure readable contrast on white background: 40% lightness
  return `hsl(${hue}, 65%, 40%)`;
};

const formatChatDateHeader = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(d, today)) {
    return "HARI INI";
  } else if (isSameDay(d, yesterday)) {
    return "KEMARIN";
  } else {
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
};

// ---------- Main Component ----------
export default function ServiceHub() {
  const location = useLocation();
  const user = useStore((state) => state.user);
  const showAlert = useStore((s) => s.showAlert);
  const showConfirm = useStore((s) => s.showConfirm);

  // Which bottom sheet is open
  const [openSheet, setOpenSheet] = useState(location.state?.openSheet || null); // null | 'keluhan' | 'saran' | 'berita' | 'pantauan'

  const [tickets, setTickets] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getTickets:{}");
      if (cached) {
        const entry = JSON.parse(cached);
        if (entry?.response?.status === "success" && Array.isArray(entry.response.data)) {
          return entry.response.data;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [newsList, setNewsList] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getNews:{}");
      if (cached) {
        const entry = JSON.parse(cached);
        if (entry?.response?.status === "success" && Array.isArray(entry.response.data)) {
          return [...entry.response.data].sort((a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cachedTickets = localStorage.getItem("tbu_pay_cache_v1:getTickets:{}");
      const cachedNews = localStorage.getItem("tbu_pay_cache_v1:getNews:{}");
      if (cachedTickets || cachedNews) return false;
    } catch (e) {
      console.error(e);
    }
    return true;
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [dataSource, setDataSource] = useState(() => {
    try {
      const cachedTickets = localStorage.getItem("tbu_pay_cache_v1:getTickets:{}");
      const cachedNews = localStorage.getItem("tbu_pay_cache_v1:getNews:{}");
      if (cachedTickets || cachedNews) return "cache";
    } catch (e) {
      console.error(e);
    }
    return "network";
  });

  const [keluhanForm, setKeluhanForm] = useState({ kategori: "Lampu Penerangan", deskripsi: "" });
  const [saranForm, setSaranForm] = useState({ deskripsi: "" });
  const [newsForm, setNewsForm] = useState({ judul: "", konten: "" });
  const [publishingNews, setPublishingNews] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsReplies, setNewsReplies] = useState([]);
  const [replyForm, setReplyForm] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [newsDateFilter, setNewsDateFilter] = useState(""); // "" = semua, "YYYY-MM" = filter bulan
  const [ticketReplies, setTicketReplies] = useState([]);
  const [ticketReplyForm, setTicketReplyForm] = useState("");
  const [sendingTicketReply, setSendingTicketReply] = useState(false);
  const [loadingTicketReplies, setLoadingTicketReplies] = useState(false);

  const [generalChats, setGeneralChats] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getGeneralChats:{}");
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
  const [generalChatForm, setGeneralChatForm] = useState("");
  const [sendingGeneralChat, setSendingGeneralChat] = useState(false);
  const [loadingGeneralChats, setLoadingGeneralChats] = useState(false);

  const ticketSummary = useMemo(() => {
    const counts = { open: 0, proses: 0, done: 0 };
    tickets.forEach((ticket) => {
      const key = ticket?.status;
      if (key && counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [tickets]);

  const fetchTickets = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else {
      setLoading((prev) => (tickets.length > 0 ? false : true));
    }
    try {
      const res = await getTickets(forceRefresh ? { forceRefresh: true } : {});
      if (res?._meta?.source) setDataSource(res._meta.source);
      if (res.status === "success") {
        setTickets(res.data);
      }
    } catch (e) { 
      console.error(e); 
    }
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchNews = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else {
      setLoading((prev) => (newsList.length > 0 ? false : true));
    }
    try {
      const res = await getNews(forceRefresh ? { forceRefresh: true } : {});
      if (res?._meta?.source) setDataSource(res._meta.source);
      if (res.status === "success") {
        const sorted = [...res.data].sort((a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0));
        setNewsList(sorted);
      }
    } catch (e) { 
      console.error(e); 
    }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchTickets();
    fetchNews();
  }, []);

  const pull = usePullToRefresh({
    onRefresh: async () => { await Promise.all([fetchTickets(true), fetchNews(true)]); },
    disabled: loading || refreshing || openSheet !== null,
  });

  const fetchNewsReplies = async (idBerita) => {
    if (!idBerita) return;
    setLoadingReplies(true);
    try {
      const res = await getNewsReplies(idBerita);
      const data = res.status === "success" ? (res.data || []) : [];
      const sorted = [...data].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
      setNewsReplies(sorted);
    } catch (e) { setNewsReplies([]); }
    finally { setLoadingReplies(false); }
  };

  const fetchTicketReplies = async (idTiket, forceRefresh = false) => {
    if (!idTiket) return;
    setLoadingTicketReplies(true);
    try {
      const res = await getTicketReplies(idTiket, forceRefresh ? { forceRefresh: true } : {});
      const data = res.status === "success" ? (res.data || []) : [];
      const sorted = [...data].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
      setTicketReplies(sorted);
    } catch (e) { setTicketReplies([]); }
    finally { setLoadingTicketReplies(false); }
  };

  const fetchGeneralChats = async (forceRefresh = false) => {
    setLoadingGeneralChats(true);
    try {
      const res = await getGeneralChats(forceRefresh ? { forceRefresh: true } : {});
      if (res?.status === "success") {
        const sorted = [...res.data].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        setGeneralChats(sorted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGeneralChats(false);
    }
  };

  const handleSendGeneralChat = async (e) => {
    if (e) e.preventDefault();
    if (!generalChatForm.trim()) return;

    setSendingGeneralChat(true);
    try {
      const payload = {
        id_user: user?.id_user || "warga-anonim",
        nama_pengirim: user?.nama || "Warga Anonim",
        role_pengirim: user?.role || "warga",
        isi_chat: generalChatForm.trim(),
      };
      const res = await createGeneralChat(payload);
      if (res?.status === "success") {
        setGeneralChatForm("");
        await fetchGeneralChats(true); // force refresh to get latest chats
      } else {
        showAlert(res.message || "Gagal mengirim pesan.", { variant: "danger", title: "Error" });
      }
    } catch (error) {
      showAlert("Gagal terhubung ke server.", { variant: "danger", title: "Koneksi Gagal" });
    } finally {
      setSendingGeneralChat(false);
    }
  };

  useEffect(() => {
    if (openSheet === "grupchat") {
      fetchGeneralChats(true);
    }
  }, [openSheet]);

  const openTicketDetail = async (ticket) => {
    setSelectedTicket(ticket);
    setOpenSheet("ticketDetail");
    setTicketReplyForm("");
    await fetchTicketReplies(ticket.id_tiket, true);
  };

  const handleSendTicketReply = async (e) => {
    e.preventDefault();
    const text = ticketReplyForm.trim();
    if (!selectedTicket?.id_tiket || !text) return;
    setSendingTicketReply(true);
    try {
      const res = await createTicketReply({
        id_tiket: selectedTicket.id_tiket,
        id_user: user?.id_user || "",
        nama_pengirim: user?.nama || "Warga",
        role_pengirim: user?.role || "warga",
        isi_balasan: text,
      });
      if (res.status === "success") {
        setTicketReplyForm("");
        await fetchTicketReplies(selectedTicket.id_tiket, true);
      } else {
        showAlert(res.message || "Gagal mengirim balasan.", { variant: "danger", title: "Gagal" });
      }
    } catch { showAlert("Terjadi kesalahan koneksi.", { variant: "danger", title: "Kesalahan Koneksi" }); }
    finally { setSendingTicketReply(false); }
  };

  const closeSheet = () => {
    setOpenSheet(null);
  };

  const openNewsDetail = async (news) => {
    setSelectedNews(news);
    setOpenSheet("newsDetail");
    setReplyForm("");
    await fetchNewsReplies(news.id_berita);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    const text = replyForm.trim();
    if (!selectedNews?.id_berita || !text) return;
    setSendingReply(true);
    try {
      const res = await createNewsReply({
        id_berita: selectedNews.id_berita,
        id_user: user?.id_user || "",
        nama_pengirim: user?.nama || "Warga",
        isi_balasan: text,
      });
      if (res.status === "success") {
        setReplyForm("");
        await fetchNewsReplies(selectedNews.id_berita);
      } else {
        showAlert(res.message || "Gagal mengirim balasan.", { variant: "danger", title: "Gagal" });
      }
    } catch { showAlert("Terjadi kesalahan koneksi.", { variant: "danger", title: "Kesalahan Koneksi" }); }
    finally { setSendingReply(false); }
  };

  const handlePublishNews = async (e) => {
    e.preventDefault();
    if (!newsForm.judul.trim() || !newsForm.konten.trim()) {
      showAlert("Judul dan isi berita wajib diisi.", { variant: "warning", title: "Form Tidak Lengkap" });
      return;
    }
    setPublishingNews(true);
    try {
      const res = await createNews({ judul: newsForm.judul.trim(), konten: newsForm.konten.trim(), created_by_role: user?.role || "" });
      if (res.status === "success") {
        showAlert("Berita berhasil dipublikasikan.", { variant: "success", title: "Berhasil" });
        setNewsForm({ judul: "", konten: "" });
        await fetchNews(true);
      } else {
        showAlert(res.message || "Gagal mempublikasikan berita.", { variant: "danger", title: "Gagal" });
      }
    } catch { showAlert("Terjadi kesalahan koneksi.", { variant: "danger", title: "Kesalahan Koneksi" }); }
    finally { setPublishingNews(false); }
  };

  const handleKeluhanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTicket({ id_user_pelapor: user.id_user, kategori: "keluhan", deskripsi: `[${keluhanForm.kategori}] ${keluhanForm.deskripsi}`, imageBase64: "" });
      showAlert("Keluhan terkirim", { variant: "success", title: "Berhasil" });
      setKeluhanForm({ kategori: "Lampu Penerangan", deskripsi: "" });
      closeSheet();
      fetchTickets(true);
    } catch { showAlert("Gagal mengirim keluhan", { variant: "danger", title: "Gagal" }); }
    finally { setLoading(false); }
  };

  const handleSaranSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTicket({ id_user_pelapor: user.id_user, kategori: "saran", deskripsi: saranForm.deskripsi, imageBase64: "" });
      showAlert("Saran terkirim", { variant: "success", title: "Berhasil" });
      setSaranForm({ deskripsi: "" });
      closeSheet();
      fetchTickets(true);
    } catch { showAlert("Gagal mengirim saran", { variant: "danger", title: "Gagal" }); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id_tiket, status) => {
    try {
      await updateTicketStatus({ id_tiket, status, id_petugas_pic: user.id_user });
      fetchTickets(true);
    } catch { showAlert("Gagal update status", { variant: "danger", title: "Gagal" }); }
  };

  // -------- Skeleton --------
  const Skeleton = () => (
    <div className="border border-gray-200 rounded-[14px] bg-white p-[14px] flex flex-col gap-2">
      <span className="h-2.5 rounded-full bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:180%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite]" />
      <span className="h-2.5 rounded-full bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:180%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite] w-[62%]" />
    </div>
  );

  // -------- Form Field Styles --------
  const inputCls = "bg-gray-50 border border-gray-200 rounded-xl p-[12px_14px] text-[14px] font-sans text-gray-900 outline-none w-full focus:bg-white focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/10 transition-colors";
  const labelCls = "text-[11px] text-gray-500 uppercase tracking-[0.5px] font-bold";

  return (
    <div className="flex flex-col" {...pull.bind}>
      {pull.showPullHint && (
        <div className={`sticky top-2 z-[31] mx-auto mb-2.5 w-fit px-3 py-[7px] rounded-full border text-xs font-semibold ${pull.isReady ? "border-green-300 bg-green-50 text-green-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}>
          {pull.isReady ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang"}
        </div>
      )}
      <CacheFallbackBadge source={dataSource} />

      {/* ========== HUB (always rendered) ========== */}
      <div className="py-4 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold m-0 text-gray-800 dark:text-gray-100">Layanan Warga</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 m-0">Pusat informasi dan pengaduan</p>
        </div>
        <div
          className="cursor-pointer relative transition-all duration-200 flex items-center justify-center p-2 text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white active:scale-95 shrink-0 mt-1"
          onClick={() => setIsNotifOpen(true)}
        >
          <Bell size={24} className={`stroke-[1.75] transition-colors duration-500 ${!loading ? "fill-amber-400 text-amber-500" : ""}`} />
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          className="bg-white dark:bg-[#1a2640] border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all hover:border-red-300 dark:hover:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 shadow-sm dark:shadow-none"
          onClick={() => setOpenSheet("keluhan")}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-500/10 text-red-500 dark:text-red-400">
            <MessageSquareWarning size={28} />
          </div>
          <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-150">Buat Keluhan</span>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">Lapor fasilitas rusak</span>
        </button>

        <button
          className="bg-white dark:bg-[#1a2640] border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all hover:border-amber-300 dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 active:scale-95 shadow-sm dark:shadow-none"
          onClick={() => setOpenSheet("saran")}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400">
            <Lightbulb size={28} />
          </div>
          <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-150">Kotak Saran</span>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">Aspirasi untuk RT/RW</span>
        </button>
      </div>

      {/* General Group Chat Banner Card */}
      <button
        className="w-full relative overflow-hidden rounded-2xl p-4.5 mb-6 text-left cursor-pointer border border-transparent shadow-[0_4px_12px_rgba(16,185,129,0.15)] dark:shadow-none transition-all duration-300 hover:shadow-[0_6px_20px_rgba(16,185,129,0.25)] active:scale-[0.99] flex items-center justify-between gap-4 select-none"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        }}
        onClick={() => setOpenSheet("grupchat")}
      >
        {/* Glowing aura ornament */}
        <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-white/[0.08] rounded-full pointer-events-none filter blur-lg"></div>
        <div className="absolute left-[-20px] top-[-20px] w-32 h-32 bg-white/[0.05] rounded-full pointer-events-none filter blur-lg"></div>
        
        {/* Background watermark icon */}
        <MessageCircle className="absolute right-4 bottom-[-10px] w-28 h-28 text-white opacity-[0.09] pointer-events-none rotate-[-15deg]" />

        <div className="relative z-10 flex-1 flex gap-3.5 items-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/20 text-white shrink-0 shadow-inner">
            <MessageCircle size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h4 className="text-[15px] font-extrabold text-white m-0 tracking-wide uppercase">Grup Obrolan Warga</h4>
            <p className="text-[12px] text-emerald-100 mt-1 m-0 leading-tight">Ruang interaksi & koordinasi santai antar tetangga</p>
          </div>
        </div>
        
        <div className="relative z-10 shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
          <ChevronRight size={18} strokeWidth={2.5} />
        </div>
      </button>

      {/* Berita section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-[17px] font-bold text-gray-700 tracking-[-0.01em]">Berita Terkini</h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
            onClick={() => setOpenSheet("berita")}
          >
            <Newspaper size={12} />
            Lihat Semua
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {loading && newsList.length === 0 && <Skeleton />}
          {!loading && newsList.length === 0 && (
            <div className="border border-dashed border-gray-300 rounded-[14px] bg-white p-4 text-center">
              <p className="text-[14px] font-bold m-0 mb-1 text-gray-800">Belum ada berita</p>
              <span className="text-[12px] text-gray-500">Informasi dari pengurus akan muncul di sini.</span>
            </div>
          )}
          {newsList.slice(0, 2).map((news) => (
            <button
              key={news.id_berita}
              type="button"
              className="w-full border border-gray-100 dark:border-slate-800/80 rounded-[14px] bg-white dark:bg-[#1a2640] shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none p-[14px] flex gap-3 text-left cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-md"
              onClick={() => openNewsDetail(news)}
            >
              <div className="w-[46px] h-[46px] rounded-[10px] flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Newspaper size={18} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="m-0 text-[13px] font-bold text-gray-800 dark:text-gray-150">{news.judul}</p>
                <p className="m-0 mt-[3px] text-[12px] text-gray-500 dark:text-gray-400 leading-[1.4] line-clamp-2">{news.konten}</p>
              </div>
              <ChevronRight size={14} className="self-center text-gray-400 dark:text-gray-500" />
            </button>
          ))}
        </div>
      </section>

      {/* Pantauan section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-[17px] font-bold text-gray-700 tracking-[-0.01em]">Pantau Keluhan</h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 border border-slate-200 bg-slate-50 text-slate-700 rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
            onClick={() => setOpenSheet("pantauan")}
          >
            <ClipboardList size={12} />
            Lihat Semua
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {loading && tickets.length === 0 && <Skeleton />}
          {!loading && tickets.length === 0 && (
            <div className="border border-dashed border-gray-300 rounded-[14px] bg-white p-4 text-center">
              <p className="text-[14px] font-bold m-0 mb-1 text-gray-800">Belum ada tiket</p>
              <span className="text-[12px] text-gray-500">Warga dapat membuat laporan baru.</span>
            </div>
          )}
          {tickets.slice(0, 3).map((ticket) => (
            <button
              key={ticket.id_tiket}
              type="button"
              className={`w-full text-left cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-md border border-gray-100 dark:border-slate-800/80 rounded-[14px] bg-white dark:bg-[#1a2640] shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none p-[14px] ${
                ticket.status === "open" ? "border-l-4 border-l-amber-400" :
                ticket.status === "proses" ? "border-l-4 border-l-blue-400" :
                "border-l-4 border-l-green-400 dark:border-l-emerald-500"
              }`}
              onClick={() => openTicketDetail(ticket)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  ticket.status === "open" ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                  ticket.status === "proses" ? "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                  "bg-green-100 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400"
                }`}>{ticket.status}</span>
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-150">{ticket.kategori}</span>
              </div>
              <p className="m-0 text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2">{ticket.deskripsi}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ========== BOTTOM SHEET: KELUHAN ========== */}
      <BottomSheet isOpen={openSheet === "keluhan"} onClose={closeSheet} title="Buat Keluhan Warga" heightClass="max-h-[88vh]">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Kategori Keluhan</label>
            <select className={inputCls} value={keluhanForm.kategori} onChange={(e) => setKeluhanForm({ ...keluhanForm, kategori: e.target.value })}>
              <option>Lampu Penerangan</option>
              <option>Kebersihan / Sampah</option>
              <option>Keamanan</option>
              <option>Fasilitas Umum</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Deskripsi Detail</label>
            <textarea
              className={`${inputCls} resize-y`}
              rows="4"
              placeholder="Jelaskan masalah secara detail..."
              value={keluhanForm.deskripsi}
              onChange={(e) => setKeluhanForm({ ...keluhanForm, deskripsi: e.target.value })}
            />
          </div>
          <button
            className="bg-red-500 hover:bg-red-600 text-white min-h-[48px] rounded-xl font-bold shadow-[0_8px_16px_rgba(239,68,68,0.25)] border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            onClick={handleKeluhanSubmit}
            disabled={loading || !keluhanForm.deskripsi.trim()}
          >
            {loading ? "Mengirim..." : "Kirim Keluhan"}
          </button>
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: SARAN ========== */}
      <BottomSheet isOpen={openSheet === "saran"} onClose={closeSheet} title="Kotak Saran & Masukan" heightClass="max-h-[88vh]">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Saran / Aspirasi</label>
            <textarea
              className={`${inputCls} resize-y`}
              rows="5"
              placeholder="Tuliskan saran Anda di sini..."
              value={saranForm.deskripsi}
              onChange={(e) => setSaranForm({ deskripsi: e.target.value })}
            />
          </div>
          <button
            className="bg-[#0f4c81] hover:bg-[#0d3d6b] text-white min-h-[48px] rounded-xl font-bold shadow-[0_8px_16px_rgba(15,76,129,0.25)] border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            onClick={handleSaranSubmit}
            disabled={loading || !saranForm.deskripsi.trim()}
          >
            {loading ? "Mengirim..." : "Kirim Saran"}
          </button>
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: GENERAL GROUP CHAT ========== */}
      <BottomSheet isOpen={openSheet === "grupchat"} onClose={closeSheet} title="Grup Obrolan Warga" heightClass="h-[88vh]">
        <div className="flex flex-col h-[78vh] bg-[#efeae2] dark:bg-[#0b141a] transition-colors duration-300">
          
          {/* Main chat messages list */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 shadow-inner">
            {loadingGeneralChats && generalChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <RefreshCw size={22} className="text-emerald-500 animate-spin" />
                <span className="text-[12px] text-gray-500 dark:text-gray-400">Memuat obrolan...</span>
              </div>
            ) : generalChats.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="bg-white/95 dark:bg-[#1f2c34] rounded-xl px-4.5 py-2.5 text-[11px] text-gray-500 dark:text-gray-400 max-w-[85%] shadow-sm border border-gray-100 dark:border-transparent">
                  Belum ada percakapan. Mulai obrolan pertama dengan menyapa tetangga Anda!
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {(() => {
                  let lastDateHeader = null;
                  return generalChats.map((chat) => {
                    const isOwn = String(chat.id_user) === String(user?.id_user);
                    const bubbleColor = getDeterministicColor(chat.nama_pengirim);
                    const currentDateHeader = formatChatDateHeader(chat.timestamp);
                    const showDateHeader = currentDateHeader && currentDateHeader !== lastDateHeader;
                    if (showDateHeader) {
                      lastDateHeader = currentDateHeader;
                    }
                    
                    return (
                      <div key={chat.id_chat} className="flex flex-col w-full">
                        {showDateHeader && (
                          <div className="flex justify-center my-3.5 select-none">
                            <span className="bg-white/90 dark:bg-[#1f2c34]/90 text-[10px] text-gray-500 dark:text-gray-400 font-extrabold px-3.5 py-1.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase tracking-wider">
                              {currentDateHeader}
                            </span>
                          </div>
                        )}
                        <div className={`flex items-start gap-2 max-w-[85%] ${isOwn ? "self-end flex-row-reverse ml-auto" : "self-start mr-auto"}`}>
                          {/* Avatar for others */}
                          {!isOwn && (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-sm border border-white dark:border-transparent select-none uppercase"
                                 style={{ backgroundColor: bubbleColor }}>
                              {getInitials(chat.nama_pengirim)}
                            </div>
                          )}
                          
                          <div className={`rounded-2xl p-[9px_13px] relative shadow-[0_1px_1px_rgba(0,0,0,0.08)] flex flex-col ${
                            isOwn 
                              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100 rounded-tr-xs" 
                              : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-tl-xs"
                          }`}>
                            {/* Sender Info for others */}
                            {!isOwn && (
                              <div className="flex items-center gap-1.5 mb-1 shrink-0 select-none">
                                <span className="text-[11px] font-extrabold leading-none truncate" style={{ color: bubbleColor }}>
                                  {chat.nama_pengirim}
                                </span>
                                {chat.role_pengirim && chat.role_pengirim !== "warga" && (
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md leading-none uppercase tracking-wider border ${
                                    chat.role_pengirim === "admin" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                  }`}>
                                    {chat.role_pengirim}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Message body */}
                            <p className="m-0 text-[13px] leading-relaxed break-words whitespace-pre-wrap pr-10">
                              {chat.isi_chat}
                            </p>
                            
                            {/* Timestamp in corner */}
                            <span className="absolute bottom-1 right-2 text-[9px] text-gray-400 dark:text-gray-500 font-medium select-none tabular-nums">
                              {chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Sticky text-input control pill bar */}
          <div className="bg-white dark:bg-[#131c33] border-t border-gray-100 dark:border-slate-800/80 p-3 shrink-0 flex items-center gap-2">
            <form onSubmit={handleSendGeneralChat} className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Tulis pesan warga..."
                className="flex-1 bg-gray-50 dark:bg-[#1b2641] border border-gray-200 dark:border-[#2c3c5e] text-gray-900 dark:text-gray-100 rounded-full px-4 py-2.5 text-[13px] outline-none transition-colors focus:bg-white dark:focus:bg-[#1b2641] focus:border-emerald-500"
                value={generalChatForm}
                onChange={(e) => setGeneralChatForm(e.target.value)}
                disabled={sendingGeneralChat}
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center border-none cursor-pointer hover:bg-emerald-600 transition-colors shadow-sm active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                disabled={sendingGeneralChat || !generalChatForm.trim()}
                aria-label="Kirim Pesan"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: BERITA ========== */}
      <BottomSheet isOpen={openSheet === "berita"} onClose={closeSheet} title="Berita Terkini" heightClass="h-[88vh]">
        <div className="p-4 flex flex-col gap-3">
          {/* Toolbar: Filter Tanggal + Tambah Berita (Admin) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="month"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-[12px] bg-white focus:outline-none focus:border-blue-400 text-gray-600 appearance-none"
                value={newsDateFilter}
                onChange={(e) => setNewsDateFilter(e.target.value)}
              />
            </div>
            {newsDateFilter && (
              <button
                type="button"
                className="px-3 py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 border-none rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                onClick={() => setNewsDateFilter("")}
              >
                Reset
              </button>
            )}
            {user?.role === "admin" && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-[12px] font-bold border-none rounded-xl cursor-pointer hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
                onClick={() => setOpenSheet("tambahBerita")}
              >
                <Plus size={14} />
                Tambah
              </button>
            )}
          </div>
 
          {/* Refresh */}
          <button
            className="inline-flex items-center justify-center gap-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 rounded-xl py-2 border-none cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors w-full"
            onClick={() => fetchNews(true)}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Memuat ulang..." : "Muat Ulang Berita"}
          </button>

          {loading && (
            <div className="animate-pulse flex flex-col gap-3">
              <div className="h-24 bg-gray-100 rounded-[14px]"></div>
              <div className="h-24 bg-gray-100 rounded-[14px]"></div>
            </div>
          )}
          
          {(() => {
            const filteredNews = newsDateFilter
              ? newsList.filter((n) => {
                  if (!n.tanggal) return false;
                  const d = new Date(n.tanggal);
                  const ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
                  return ym === newsDateFilter;
                })
              : newsList;

            if (!loading && filteredNews.length === 0) {
              return (
                <div className="text-center py-8 bg-gray-50 rounded-[14px] border border-dashed border-gray-200">
                  <Newspaper size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-[13px] text-gray-500 m-0 font-semibold">
                    {newsDateFilter ? "Tidak ada berita di bulan ini" : "Belum ada berita terbaru"}
                  </p>
                  {newsDateFilter && (
                    <button
                      type="button"
                      className="mt-2 text-[12px] text-blue-600 font-semibold bg-transparent border-none cursor-pointer underline"
                      onClick={() => setNewsDateFilter("")}
                    >
                      Tampilkan semua berita
                    </button>
                  )}
                </div>
              );
            }

            return filteredNews.map((news) => (
              <div key={news.id_berita} className="bg-white border border-gray-100 rounded-[14px] p-4 shadow-sm">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <p className="text-[11px] text-gray-400 m-0">{news.tanggal ? new Date(news.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 text-blue-700 rounded-full px-2 py-1 text-[11px] font-semibold cursor-pointer"
                    onClick={() => openNewsDetail(news)}
                  >
                    <MessageCircle size={12} />
                    Detail & Balas
                  </button>
                </div>
                <h4 className="mt-1 m-0 text-[15px] font-bold text-gray-900">{news.judul}</h4>
                <p className="text-[13px] text-gray-500 mt-1 m-0 line-clamp-3">{news.konten}</p>
              </div>
            ));
          })()}
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: TAMBAH BERITA (Admin Only) ========== */}
      <BottomSheet isOpen={openSheet === "tambahBerita"} onClose={() => setOpenSheet("berita")} title="Publikasi Berita Baru" heightClass="h-fit max-h-[80vh]">
        <form className="p-5 flex flex-col gap-4" onSubmit={handlePublishNews}>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Judul Berita</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              placeholder="Masukkan judul berita atau pengumuman"
              value={newsForm.judul}
              onChange={(e) => setNewsForm({ ...newsForm, judul: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Isi Berita</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] bg-gray-50 resize-y focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              rows="5"
              placeholder="Tulis isi berita atau pengumuman selengkapnya..."
              value={newsForm.konten}
              onChange={(e) => setNewsForm({ ...newsForm, konten: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-[13px] border-none cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            disabled={publishingNews}
          >
            <Send size={14} />
            {publishingNews ? "Memublikasikan..." : "Publikasi Sekarang"}
          </button>
        </form>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: NEWS DETAIL ========== */}
      <BottomSheet isOpen={openSheet === "newsDetail" && !!selectedNews} onClose={closeSheet} title="Detail Informasi" heightClass="h-[88vh]">
        {selectedNews && (
          <div className="p-4 flex flex-col gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500 bg-gray-100 border-none rounded-full px-3 py-1.5 w-fit cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => setOpenSheet("berita")}
            >
              ← Kembali ke Daftar Berita
            </button>
            <p className="text-[11px] text-gray-400 m-0">{selectedNews.tanggal ? new Date(selectedNews.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
            <h3 className="m-0 text-[17px] font-bold text-gray-900 leading-[1.3]">{selectedNews.judul}</h3>
            <p className="text-[14px] text-gray-600 m-0 leading-relaxed whitespace-pre-wrap">{selectedNews.konten}</p>
            
            <div className="mt-2 flex flex-col gap-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-[14px] font-bold text-gray-800 m-0">Diskusi Warga</p>
                {!loadingReplies && newsReplies.length > 0 && (
                  <span className="text-[11px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                    {newsReplies.length} Pesan
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-[260px] max-h-[38vh] overflow-y-auto bg-[#efeae2] rounded-2xl p-4 flex flex-col gap-3.5 border border-gray-200/50 shadow-inner">
                {loadingReplies ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <RefreshCw size={22} className="text-gray-400 animate-spin" />
                    <span className="text-[12px] text-gray-500">Memuat komentar...</span>
                  </div>
                ) : newsReplies.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="bg-white/95 rounded-xl px-4.5 py-2.5 text-[11px] text-gray-500 max-w-[85%] shadow-sm">
                      Belum ada tanggapan. Jadilah warga pertama yang berdiskusi terkait berita ini!
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(() => {
                      let lastDateHeader = null;
                      return newsReplies.map((reply) => {
                        const isOwn = String(reply.id_user) === String(user?.id_user);
                        const bubbleColor = getDeterministicColor(reply.nama_pengirim);
                        const currentDateHeader = formatChatDateHeader(reply.timestamp);
                        const showDateHeader = currentDateHeader && currentDateHeader !== lastDateHeader;
                        if (showDateHeader) {
                          lastDateHeader = currentDateHeader;
                        }
                        
                        return (
                          <div key={reply.id_balasan} className="flex flex-col gap-2">
                            {showDateHeader && (
                              <div className="flex justify-center my-2 sticky top-1 z-10">
                                <span className="bg-white/90 text-gray-500 text-[10px] font-extrabold uppercase px-3 py-1 rounded-lg shadow-sm border border-gray-150/50 backdrop-blur-xs tracking-wider">
                                  {currentDateHeader}
                                </span>
                              </div>
                            )}
                            <div className={`flex gap-2 items-end max-w-[85%] ${isOwn ? "self-end ml-auto" : "self-start mr-auto"}`}>
                              {!isOwn && (
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 shadow-sm mb-0.5"
                                  style={{ backgroundColor: bubbleColor }}
                                  title={reply.nama_pengirim}
                                >
                                  {getInitials(reply.nama_pengirim)}
                                </div>
                              )}
                              
                              <div
                                className={`flex flex-col gap-0.5 rounded-[18px] px-3.5 py-2 shadow-[0_1px_1.5px_rgba(0,0,0,0.08)] ${
                                  isOwn
                                    ? "bg-[#d9fdd3] text-gray-800 rounded-tr-none border border-[#e1f5fe]/10"
                                    : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                                }`}
                              >
                                {!isOwn && (
                                  <span 
                                    className="text-[10px] font-extrabold uppercase tracking-wide mb-0.5"
                                    style={{ color: bubbleColor }}
                                  >
                                    {reply.nama_pengirim || "Warga"}
                                  </span>
                                )}
                                {isOwn && (
                                  <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wide self-end mb-0.5">
                                    Anda
                                  </span>
                                )}
                                <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-gray-700 font-medium">
                                  {reply.isi_balasan}
                                </p>
                                <span className="text-[9px] text-gray-400 mt-1 self-end leading-none text-right">
                                  {reply.timestamp ? new Date(reply.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>              <form onSubmit={handleSendReply} className="flex items-center gap-2 mt-1.5 pt-1.5 bg-white dark:bg-[#131c33] sticky bottom-0">
                <input
                  type="text"
                  className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-[13px] bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="Komentari berita ini..."
                  value={replyForm}
                  onChange={(e) => setReplyForm(e.target.value)}
                  disabled={sendingReply}
                  required
                />
                <button
                  type="submit"
                  className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full border-none cursor-pointer flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                  disabled={sendingReply || !replyForm.trim()}
                >
                  <Send size={15} className="text-white" />
                </button>
              </form>
            </div>
          </div>
        )}
      </BottomSheet>
 
      {/* ========== BOTTOM SHEET: PANTAUAN ========== */}
      <BottomSheet isOpen={openSheet === "pantauan"} onClose={closeSheet} title="Pantauan Keluhan Warga" heightClass="h-[88vh]">
        <div className="p-4 flex flex-col gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 rounded-xl py-2 border-none cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors w-full"
            onClick={() => fetchTickets(true)}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>
 
          {loading && <Skeleton />}
          {!loading && tickets.length === 0 && (
            <div className="border border-dashed border-gray-300 rounded-[14px] bg-white p-4 text-center">
              <p className="text-[14px] font-bold m-0 mb-1 text-gray-800">Tidak ada tiket</p>
              <span className="text-[12px] text-gray-500">Daftar pantauan akan terisi ketika ada laporan masuk.</span>
            </div>
          )}
          {tickets.map((ticket) => (
            <button
              key={ticket.id_tiket}
              type="button"
              className="w-full text-left cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-md bg-white dark:bg-[#1a2640] border border-gray-100 dark:border-slate-800/80 rounded-[14px] p-4 shadow-sm"
              onClick={() => openTicketDetail(ticket)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[12px] font-semibold text-gray-500">[{ticket.kategori}]</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  ticket.status === "open" ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200" :
                  ticket.status === "proses" ? "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200" :
                  "bg-green-100 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400 border border-green-200"
                }`}>{ticket.status}</span>
              </div>
              <p className="text-[14px] mt-1 m-0 text-gray-800 dark:text-gray-150 line-clamp-3">{ticket.deskripsi}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 m-0">
                Dilaporkan oleh ID: {ticket.id_user_pelapor} • {new Date(ticket.timestamp).toLocaleDateString("id-ID")}
              </p>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: TICKET DETAIL ========== */}
      <BottomSheet isOpen={openSheet === "ticketDetail" && !!selectedTicket} onClose={closeSheet} title="Detail Keluhan" heightClass="h-[88vh]">
        {selectedTicket && (
          <div className="p-4 flex flex-col gap-3 h-full overflow-y-auto">
            {/* Ringkasan Keluhan */}
            <div className="bg-gray-50 dark:bg-[#1a2640]/40 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200/60 dark:bg-slate-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedTicket.kategori}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedTicket.status === "open" ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200" :
                  selectedTicket.status === "proses" ? "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200" :
                  "bg-green-100 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400 border border-green-200"
                }`}>{selectedTicket.status.toUpperCase()}</span>
              </div>
              
              <div className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
                {selectedTicket.deskripsi}
              </div>

              {selectedTicket.url_foto_kondisi && (
                <div className="mt-1">
                  <img src={selectedTicket.url_foto_kondisi} alt="Foto Kondisi" className="w-full max-h-[160px] object-cover rounded-xl border border-gray-200 dark:border-slate-700" />
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 pt-2 border-t border-gray-200/60 dark:border-slate-800/50">
                <span>Pelapor: <strong className="text-gray-600 dark:text-gray-300">{selectedTicket.id_user_pelapor}</strong></span>
                <span>{new Date(selectedTicket.timestamp).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>

              {selectedTicket.id_petugas_pic && (
                <div className="mt-1 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100/50 dark:border-blue-500/20 rounded-xl px-3 py-1.5 text-[11px] text-blue-700 dark:text-blue-400 flex justify-between items-center">
                  <span>PIC Petugas:</span>
                  <strong className="font-bold">{selectedTicket.id_petugas_pic}</strong>
                </div>
              )}
            </div>

            {/* Area Tanya Jawab (WhatsApp Style) */}
            <div className="flex flex-col gap-2 mt-2 flex-1">
              <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 m-0 flex items-center gap-1.5 px-1">
                <MessageCircle size={15} className="text-blue-500" />
                Tanya Jawab Keluhan
              </p>

              <div className="flex-1 min-h-[220px] max-h-[35vh] overflow-y-auto bg-[#efeae2] rounded-2xl p-4 flex flex-col gap-3 border border-gray-200/50 shadow-inner">
                {loadingTicketReplies ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <RefreshCw size={24} className="text-gray-400 animate-spin" />
                    <span className="text-[12px] text-gray-500">Memuat tanya jawab...</span>
                  </div>
                ) : ticketReplies.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="bg-white/90 dark:bg-slate-900 rounded-xl px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 max-w-[85%] shadow-sm">
                      Belum ada obrolan. Gunakan form di bawah untuk bertanya jawab terkait keluhan ini.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {(() => {
                      let lastDateHeader = null;
                      return ticketReplies.map((reply) => {
                        const isOwn = String(reply.id_user) === String(user?.id_user);
                        const currentDateHeader = formatChatDateHeader(reply.timestamp);
                        const showDateHeader = currentDateHeader && currentDateHeader !== lastDateHeader;
                        if (showDateHeader) {
                          lastDateHeader = currentDateHeader;
                        }

                        return (
                          <div key={reply.id_balasan} className="flex flex-col gap-1.5">
                            {showDateHeader && (
                              <div className="flex justify-center my-2 sticky top-1 z-10">
                                <span className="bg-white/90 dark:bg-slate-900 text-gray-500 dark:text-gray-400 text-[10px] font-extrabold uppercase px-3 py-1 rounded-lg shadow-sm border border-gray-150/50 backdrop-blur-xs tracking-wider">
                                  {currentDateHeader}
                                </span>
                              </div>
                            )}
                            <div
                              className={`flex flex-col gap-0.5 max-w-[85%] rounded-[18px] px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.1)] ${
                                isOwn
                                  ? "self-end bg-[#d9fdd3] text-gray-800 rounded-tr-none ml-auto border border-[#e1f5fe]/10"
                                  : "self-start bg-white text-gray-800 rounded-tl-none mr-auto border border-gray-100"
                              }`}
                            >
                              {!isOwn && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                                  <span>{reply.nama_pengirim || "Pengguna"}</span>
                                  {reply.role_pengirim && reply.role_pengirim !== "warga" && (
                                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                                      reply.role_pengirim === "admin" ? "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200" :
                                      "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200"
                                    }`}>
                                      {reply.role_pengirim}
                                    </span>
                                  )}
                                </div>
                              )}
                              {isOwn && reply.role_pengirim && reply.role_pengirim !== "warga" && (
                                <div className="text-[9px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wide self-end mb-0.5">
                                  Anda ({reply.role_pengirim})
                                </div>
                              )}
                              <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap break-words">{reply.isi_balasan}</p>
                              <span className="text-[9px] text-gray-400 mt-1 self-end leading-none text-right">
                                {reply.timestamp ? new Date(reply.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Form Balasan Chat */}
              {selectedTicket.status === "done" ? (
                <div className="bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 text-gray-500 dark:text-gray-400 rounded-xl py-3 px-4 text-center text-[12px] font-bold mt-1 shadow-sm">
                  Keluhan ini telah diselesaikan & ditutup. Tanya jawab dinonaktifkan.
                </div>
              ) : (
                <form onSubmit={handleSendTicketReply} className="flex items-center gap-2 mt-1 pt-1 bg-white dark:bg-[#131c33]">
                  <input
                    type="text"
                    className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-[13px] bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                    placeholder="Ketik pesan balasan..."
                    value={ticketReplyForm}
                    onChange={(e) => setTicketReplyForm(e.target.value)}
                    disabled={sendingTicketReply}
                    required
                  />
                  <button
                    type="submit"
                    className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full border-none cursor-pointer flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                    disabled={sendingTicketReply || !ticketReplyForm.trim()}
                  >
                    <Send size={15} className="text-white" />
                  </button>
                </form>
              )}
            </div>

            {/* Aksi Petugas & Admin (PIC / Status / Close) */}
            {(user?.role === "admin" || user?.role === "petugas") && selectedTicket.status !== "done" && (
              <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-gray-150 dark:border-slate-800/50">
                {selectedTicket.status === "open" && (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-1.5 bg-blue-100 text-blue-700 font-bold py-3.5 px-4 rounded-xl text-[13px] border-none cursor-pointer transition-all hover:bg-blue-200 active:scale-95"
                    onClick={() =>
                      showConfirm(
                        `Tandai keluhan ini sedang diproses?\n\n"${selectedTicket.deskripsi}"`,
                        async () => {
                          await updateStatus(selectedTicket.id_tiket, "proses");
                          setSelectedTicket(prev => prev ? { ...prev, status: "proses", id_petugas_pic: user.id_user } : null);
                        },
                        { title: "Konfirmasi Proses", variant: "warning" }
                      )
                    }
                  >
                    <MessageSquareWarning size={16} /> Tandai Sedang Diproses
                  </button>
                )}

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-[13px] border-none shadow-[0_4px_12px_rgba(16,185,129,0.25)] cursor-pointer transition-all active:scale-95"
                  onClick={() => {
                    showConfirm(
                      `Tutup dan tandai keluhan ini sebagai selesai?\n\n"${selectedTicket.deskripsi}"`,
                      async () => {
                        await updateStatus(selectedTicket.id_tiket, "done");
                        setSelectedTicket(prev => prev ? { ...prev, status: "done", id_petugas_pic: user.id_user } : null);
                      },
                      { title: "Selesaikan Keluhan", variant: "success" }
                    );
                  }}
                >
                  <CheckCircle size={16} /> Tutup & Selesaikan Keluhan (Done)
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </div>
  );
}
