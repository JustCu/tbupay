import { useState, useEffect, useMemo, Component } from "react";
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
  Plus,
  ArrowLeft,
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

// ---------- Helpers ----------
const safeDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (typeof dateVal === 'string') return new Date(dateVal.replace(" ", "T"));
  return new Date(dateVal);
};

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
  const isDark = document.documentElement.classList.contains("dark");
  const lightness = isDark ? "70%" : "40%";
  return `hsl(${hue}, 65%, ${lightness})`;
};

const formatChatDateHeader = (dateStr) => {
  if (!dateStr) return "";
  const d = safeDate(dateStr);
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

// ---------- React Error Boundary Component ----------
class ServiceHubErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ServiceHub caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 rounded-2xl flex flex-col gap-3">
          <h3 className="text-red-700 dark:text-red-400 font-bold text-base m-0">Gagal Memuat Halaman Layanan</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 m-0">Terjadi kesalahan saat merender halaman ini pada browser Anda:</p>
          <pre className="p-3 bg-red-100/50 dark:bg-red-950/40 rounded-xl text-xs text-red-800 dark:text-red-300 overflow-x-auto whitespace-pre-wrap font-mono break-all max-h-[120px]">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 w-fit px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs border-none cursor-pointer hover:bg-red-700 active:scale-95 transition-all shadow-sm"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- Main Component ----------
function ServiceHub() {
  const location = useLocation();
  const user = useStore((state) => state.user);
  const isAdmin = user?.role === "admin";
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
          return [...entry.response.data].sort((a, b) => safeDate(b.tanggal || 0) - safeDate(a.tanggal || 0));
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
  const hasUnreadNotif = useStore((state) => state.hasUnreadNotif);
  const setHasUnreadNotif = useStore((state) => state.setHasUnreadNotif);
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
      if (res.status === "success" && Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a, b) => safeDate(b.tanggal || 0) - safeDate(a.tanggal || 0));
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

  const fetchNewsReplies = async (id_berita, forceRefresh = false) => {
    if (!id_berita) return;
    setLoadingReplies(true);
    try {
      const res = await getNewsReplies(id_berita, forceRefresh ? { forceRefresh: true } : {});
      const list = res?.status === "success" && Array.isArray(res.data) ? res.data : [];
      const sorted = [...list].sort((a, b) => safeDate(a.timestamp || 0) - safeDate(b.timestamp || 0));
      setNewsReplies(sorted);
    } catch (e) { 
      console.error("Error fetching news replies:", e);
      setNewsReplies([]); 
    } finally { 
      setLoadingReplies(false); 
    }
  };

  const fetchTicketReplies = async (id_tiket, forceRefresh = false) => {
    if (!id_tiket) return;
    setLoadingTicketReplies(true);
    try {
      const res = await getTicketReplies(id_tiket, forceRefresh ? { forceRefresh: true } : {});
      const list = res?.status === "success" && Array.isArray(res.data) ? res.data : [];
      const sorted = [...list].sort((a, b) => safeDate(a.timestamp || 0) - safeDate(b.timestamp || 0));
      setTicketReplies(sorted);
      setSelectedTicket((prev) => (prev && prev.id_tiket === id_tiket ? { ...prev, replies: sorted } : prev));
    } catch (e) { 
      console.error("Error fetching ticket replies:", e);
      setTicketReplies([]); 
    } finally { 
      setLoadingTicketReplies(false); 
    }
  };

  const fetchGeneralChats = async (forceRefresh = false) => {
    setLoadingGeneralChats(true);
    try {
      const res = await getGeneralChats(forceRefresh ? { forceRefresh: true } : {});
      if (res?.status === "success" && Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a, b) => safeDate(a.timestamp || 0) - safeDate(b.timestamp || 0));
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
    await fetchNewsReplies(news.id_berita, true);
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
        role_pengirim: user?.role || "warga",
        isi_balasan: text,
      });
      if (res.status === "success") {
        setReplyForm("");
        await fetchNewsReplies(selectedNews.id_berita, true);
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
    <div className="border border-gray-200 rounded-2xl bg-white p-4 flex flex-col gap-3">
      <span className="h-2.5 rounded-full bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:180%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite]" />
      <span className="h-2.5 rounded-full bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:180%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite] w-[62%]" />
    </div>
  );

  // -------- Form Field Styles --------
  const inputCls = "bg-[#fcfdff] dark:bg-[#1b2641] border border-gray-200 dark:border-[#2c3c5e] text-gray-900 dark:text-gray-100 rounded-xl py-3 px-4 text-[14px] font-sans outline-none w-full focus:bg-white dark:focus:bg-[#1b2641] focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/10 dark:focus:ring-blue-500/5 transition-all";
  const labelCls = "text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.5px] font-bold";

  return (
    <div className="flex flex-col" {...pull.bind}>
      {pull.showPullHint && (
        <div className={`sticky top-2 z-[31] mx-auto mb-2 w-fit px-3 py-1.5 rounded-full border text-xs font-semibold ${pull.isReady ? "border-green-300 bg-green-50 text-green-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}>
          {pull.isReady ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang"}
        </div>
      )}
      <CacheFallbackBadge source={dataSource} />

      {/* ========== HUB (always rendered) ========== */}
      <div className="pt-1 pb-4 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold m-0 text-slate-800 dark:text-slate-100">Layanan Warga</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 m-0">Pusat informasi dan pengaduan hunian terpadu</p>
        </div>
        <div
          className="cursor-pointer relative transition-all duration-200 flex items-center justify-center p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-full active:scale-95 shrink-0 mt-1"
          onClick={() => {
            setIsNotifOpen(true);
            setHasUnreadNotif(false);
          }}
        >
          <Bell 
            size={24} 
            className={`stroke-[1.75] transition-all duration-500 ${(loading || refreshing) ? "text-slate-400 dark:text-slate-500 fill-transparent" : "fill-amber-400 text-amber-500"}`} 
          />
          {hasUnreadNotif && !loading && !refreshing && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border border-white rounded-full animate-pulse z-10"></span>
          )}
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          className="bg-white dark:bg-[#151f32] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex flex-col items-start gap-3 cursor-pointer text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700/80 active:scale-[0.98] shadow-sm dark:shadow-none"
          onClick={() => setOpenSheet("keluhan")}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500/10 text-[#dc2626] dark:bg-red-500/15 dark:text-red-400 shrink-0">
            <MessageSquareWarning size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">Buat Keluhan</span>
            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-normal">Lapor fasilitas rusak</span>
          </div>
        </button>
 
        <button
          className="bg-white dark:bg-[#151f32] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex flex-col items-start gap-3 cursor-pointer text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700/80 active:scale-[0.98] shadow-sm dark:shadow-none"
          onClick={() => setOpenSheet("saran")}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/10 text-[#b45309] dark:bg-amber-500/15 dark:text-amber-300 shrink-0">
            <Lightbulb size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">Kotak Saran</span>
            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-normal">Aspirasi untuk RT/RW</span>
          </div>
        </button>
      </div>

      {/* General Group Chat Banner Card */}
      <button
        className="w-full relative overflow-hidden rounded-2xl p-5 mb-6 text-left cursor-pointer border border-transparent shadow-[0_4px_12px_rgba(15,76,129,0.15)] dark:shadow-none transition-all duration-300 hover:shadow-[0_6px_20px_rgba(15,76,129,0.25)] active:scale-[0.99] flex items-center justify-between gap-4 select-none"
        style={{
          background: "linear-gradient(135deg, #0a3460 0%, #0f4c81 100%)",
        }}
        onClick={() => setOpenSheet("grupchat")}
      >
        {/* Glowing aura ornament */}
        <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-white/[0.06] rounded-full pointer-events-none filter blur-lg"></div>
        <div className="absolute left-[-20px] top-[-20px] w-32 h-32 bg-white/[0.04] rounded-full pointer-events-none filter blur-lg"></div>
        
        {/* Background watermark icon */}
        <MessageCircle className="absolute right-4 bottom-[-10px] w-28 h-28 text-white opacity-[0.06] pointer-events-none rotate-[-15deg]" />

        <div className="relative z-10 flex-1 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/20 text-white shrink-0 shadow-inner">
            <MessageCircle size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white m-0 tracking-wide uppercase">Grup Obrolan Warga</h4>
            <p className="text-xs text-indigo-100 mt-1 m-0 leading-normal">Ruang interaksi & koordinasi santai antar tetangga</p>
          </div>
        </div>
        
        <div className="relative z-10 shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
          <ChevronRight size={18} strokeWidth={2.5} />
        </div>
      </button>

      {/* Berita section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-base font-bold text-slate-850 dark:text-slate-205 tracking-[-0.01em]">Berita Terkini</h3>
          <span
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer hover:underline transition-all select-none"
            onClick={() => setOpenSheet("berita")}
          >
            Lihat Semua
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {loading && newsList.length === 0 && <Skeleton />}
          {!loading && newsList.length === 0 && (
            <div className="border border-dashed border-slate-300 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-[#151f32] p-5 text-center">
              <p className="text-sm font-bold m-0 mb-1 text-slate-850 dark:text-slate-100">Belum ada berita</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">Informasi dari pengurus akan muncul di sini.</span>
            </div>
          )}
          {newsList.slice(0, 2).map((news) => {
            if (!news) return null;
            return (
              <button
                key={news.id_berita}
                type="button"
                className="w-full border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-[#151f32] shadow-sm dark:shadow-none p-4 flex gap-4 text-left cursor-pointer transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99]"
                onClick={() => openNewsDetail(news)}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 shrink-0 shadow-xs">
                  <Newspaper size={18} className="stroke-[2.2]" />
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-1">
                  <p className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{news.judul}</p>
                  <p className="m-0 mt-1 text-xs font-normal text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">{news.konten}</p>
                </div>
                <ChevronRight size={16} className="self-center text-slate-500 dark:text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Pantauan section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-base font-bold text-slate-850 dark:text-slate-205 tracking-[-0.01em]">Pantau Keluhan</h3>
          <span
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer hover:underline transition-all select-none"
            onClick={() => setOpenSheet("pantauan")}
          >
            Lihat Semua
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {loading && tickets.length === 0 && <Skeleton />}
          {!loading && tickets.length === 0 && (
            <div className="border border-dashed border-slate-300 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-[#151f32] p-5 text-center">
              <p className="text-sm font-bold m-0 mb-1 text-slate-850 dark:text-slate-100">Belum ada tiket</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">Warga dapat membuat laporan baru.</span>
            </div>
          )}
          {tickets.slice(0, 3).map((ticket) => {
            if (!ticket) return null;
            const isOpen = ticket.status === "open";
            const isProses = ticket.status === "proses";
            const borderClr = isOpen ? "border-l-[#f59e0b]" : isProses ? "border-l-[#3b82f6]" : "border-l-[#10b981]";
            
            return (
              <button
                key={ticket.id_tiket}
                type="button"
                className={`w-full text-left cursor-pointer transition-all duration-200 hover:shadow-xs hover:border-slate-300/80 dark:hover:border-slate-700/80 border border-slate-100 dark:border-slate-800/80 border-l-4 ${borderClr} rounded-xl bg-white dark:bg-[#131c33] shadow-xs p-3 flex flex-col gap-2 active:scale-[0.99]`}
                onClick={() => openTicketDetail(ticket)}
              >
                {/* Header Row: Category + Ticket ID + Date */}
                <div className="flex justify-between items-center w-full gap-2 shrink-0 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {ticket.kategori}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                      #{ticket.id_tiket ? ticket.id_tiket.slice(-5).toUpperCase() : ""}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 whitespace-nowrap">
                    <Clock3 size={10} className="stroke-[2.5]" />
                    {safeDate(ticket.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                </div>

                {/* Footer Section: Reporter & Status Badge (Clean, line-free design) */}
                <div className="flex items-center justify-between w-full shrink-0 select-none text-[10px]">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    Pelapor:{" "}
                    <span className="ml-1 bg-slate-50 dark:bg-slate-800/80 text-slate-655 dark:text-slate-355 font-bold px-1.5 py-0.5 rounded text-[9px] border border-slate-100/50 dark:border-transparent">
                      {ticket.id_user_pelapor || "Warga"}
                    </span>
                  </span>
                  
                  <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold border ${
                    isOpen ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20" :
                    isProses ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20" :
                    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========== BOTTOM MODAL: KELUHAN ========== */}
      <div
        className={`fixed inset-0 z-[70] flex justify-center items-center p-4 bg-black/60 backdrop-blur-[1px] transition-opacity duration-300 ${
          openSheet === "keluhan" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none overflow-hidden"
        }`}
        onClick={closeSheet}
      >
        <div
          className={`w-full max-w-[400px] bg-white dark:bg-[#131c33] rounded-[24px] h-fit max-h-[85vh] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ${
            openSheet === "keluhan" ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start pt-6 pb-4 px-6 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Buat Keluhan Warga</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-1 leading-normal pr-4">Sampaikan pengaduan atau laporan fasilitas lingkungan</p>
            </div>
            <button
              type="button"
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full border-none cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0"
              onClick={closeSheet}
            >
              <X size={16} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Form Body */}
          <div className="p-6 overflow-y-auto flex flex-col gap-4 min-h-0">
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
                className={`${inputCls} resize-none`}
                rows="4"
                placeholder="Jelaskan masalah secara detail..."
                value={keluhanForm.deskripsi}
                onChange={(e) => setKeluhanForm({ ...keluhanForm, deskripsi: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px] rounded-xl font-bold shadow-[0_4px_12px_rgba(239,68,68,0.2)] border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-2 mb-2"
              onClick={handleKeluhanSubmit}
              disabled={loading || !keluhanForm.deskripsi.trim()}
            >
              {loading ? "Mengirim..." : "Kirim Keluhan"}
            </button>
          </div>
        </div>
      </div>

      {/* ========== BOTTOM MODAL: SARAN ========== */}
      <div
        className={`fixed inset-0 z-[70] flex justify-center items-center p-4 bg-black/60 backdrop-blur-[1px] transition-opacity duration-300 ${
          openSheet === "saran" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none overflow-hidden"
        }`}
        onClick={closeSheet}
      >
        <div
          className={`w-full max-w-[400px] bg-white dark:bg-[#131c33] rounded-[24px] h-fit max-h-[85vh] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ${
            openSheet === "saran" ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start pt-6 pb-4 px-6 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Kotak Saran & Masukan</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-1 leading-normal pr-4">Salurkan aspirasi dan ide kreatif demi kemajuan bersama</p>
            </div>
            <button
              type="button"
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full border-none cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0"
              onClick={closeSheet}
            >
              <X size={16} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Form Body */}
          <div className="p-6 overflow-y-auto flex flex-col gap-4 min-h-0">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Saran / Aspirasi</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows="5"
                placeholder="Tuliskan saran Anda di sini..."
                value={saranForm.deskripsi}
                onChange={(e) => setSaranForm({ deskripsi: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="bg-[#0f4c81] hover:bg-[#0d3d6b] text-white min-h-[44px] rounded-xl font-bold shadow-[0_4px_12px_rgba(15,76,129,0.2)] border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-2 mb-2"
              onClick={handleSaranSubmit}
              disabled={loading || !saranForm.deskripsi.trim()}
            >
              {loading ? "Mengirim..." : "Kirim Saran"}
            </button>
          </div>
        </div>
      </div>

      {/* ========== STANDALONE VIEW: GENERAL GROUP CHAT ========== */}
      {openSheet === "grupchat" && (
        <div className="fixed inset-0 z-[60] w-full bg-[#efeae2] dark:bg-[#0b141a] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-655 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-205 dark:hover:bg-slate-700/60 active:scale-95"
                onClick={closeSheet}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm select-none shadow-sm">
                  GW
                </div>
                <div className="flex flex-col">
                  <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">Grup Obrolan Warga</h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Online • {generalChats.length} pesan
                  </span>
                </div>
              </div>
            </div>
            
            <button
              type="button"
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full border-none cursor-pointer transition-colors flex items-center justify-center active:scale-95"
              onClick={() => fetchGeneralChats(true)}
              disabled={loadingGeneralChats}
              title="Refresh Obrolan"
            >
              <RefreshCw size={16} className={loadingGeneralChats ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Main chat messages list */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 shadow-inner">
            {loadingGeneralChats && generalChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <RefreshCw size={22} className="text-emerald-500 animate-spin" />
                <span className="text-[12px] text-gray-500 dark:text-gray-400 font-bold">Memuat obrolan...</span>
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
                    if (!chat) return null;
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
                            <span className="bg-white/90 dark:bg-[#1f2c34]/90 text-[10px] text-gray-555 dark:text-gray-450 font-extrabold px-3.5 py-1.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase tracking-wider">
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
                            <span className="absolute bottom-1 right-2 text-[9px] text-gray-400 dark:text-gray-550 font-medium select-none tabular-nums">
                              {chat.timestamp ? safeDate(chat.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
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
          <div className="safe-footer-padding bg-white dark:bg-[#131c33] border-t border-gray-100 dark:border-slate-800/80 shrink-0 flex items-center gap-2 z-10">
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
      )}
      {/* ========== STANDALONE VIEW: BERITA ========== */}
      {openSheet === "berita" && (
        <div className="fixed inset-0 z-[60] w-full bg-slate-50 dark:bg-[#0b1329] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm">
            <button
              type="button"
              className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-655 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-700/60 active:scale-95"
              onClick={closeSheet}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Berita & Informasi</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Kumpulan berita terkini dan pengumuman lingkungan warga</p>
            </div>
          </div>

          {/* Body content */}
          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
            {/* Toolbar: Filter Tanggal + Tambah Berita (Admin) */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex-1 relative">
                <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="month"
                  className="w-full border border-gray-200 dark:border-[#2c3c5e] rounded-xl pl-9 pr-3 py-2.5 text-[12px] bg-white dark:bg-[#1b2641] text-gray-650 dark:text-gray-250 focus:outline-none focus:border-blue-400 appearance-none"
                  value={newsDateFilter}
                  onChange={(e) => setNewsDateFilter(e.target.value)}
                />
              </div>
              {newsDateFilter && (
                <button
                  type="button"
                  className="px-3.5 py-2.5 text-[11px] font-bold text-gray-650 dark:text-gray-300 bg-gray-150 dark:bg-slate-800 border-none rounded-xl cursor-pointer hover:bg-gray-205 dark:hover:bg-slate-750 transition-colors whitespace-nowrap active:scale-95"
                  onClick={() => setNewsDateFilter("")}
                >
                  Reset
                </button>
              )}
              {user?.role === "admin" && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-[12px] font-extrabold border-none rounded-xl cursor-pointer hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm active:scale-95"
                  onClick={() => setOpenSheet("tambahBerita")}
                >
                  <Plus size={14} />
                  Tambah
                </button>
              )}
            </div>
   
            {/* Refresh */}
            <button
              className="inline-flex items-center justify-center gap-2 text-[12px] font-bold text-gray-650 dark:text-gray-300 bg-gray-150 dark:bg-slate-800 rounded-xl py-2.5 border-none cursor-pointer hover:bg-gray-205 dark:hover:bg-slate-750 transition-colors w-full shrink-0 active:scale-[0.99]"
              onClick={() => fetchNews(true)}
              disabled={refreshing}
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Memuat ulang..." : "Muat Ulang Berita"}
            </button>

            {loading && (
              <div className="animate-pulse flex flex-col gap-3">
                <div className="h-24 bg-gray-200 dark:bg-slate-800 rounded-[14px]"></div>
                <div className="h-24 bg-gray-200 dark:bg-slate-800 rounded-[14px]"></div>
              </div>
            )}
            
            {(() => {
              const filteredNews = newsDateFilter
                ? newsList.filter((n) => {
                    if (!n.tanggal) return false;
                    const d = safeDate(n.tanggal);
                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    return ym === newsDateFilter;
                  })
                : newsList;

              if (!loading && filteredNews.length === 0) {
                return (
                  <div className="text-center py-8 bg-white dark:bg-[#131c33] rounded-2xl border border-dashed border-gray-200 dark:border-slate-800/80 p-5">
                    <Newspaper size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                    <p className="text-[13px] text-gray-555 dark:text-gray-400 m-0 font-semibold">
                      {newsDateFilter ? "Tidak ada berita di bulan ini" : "Belum ada berita terbaru"}
                    </p>
                    {newsDateFilter && (
                      <button
                        type="button"
                        className="mt-2 text-[12px] text-blue-600 dark:text-indigo-400 font-bold bg-transparent border-none cursor-pointer underline"
                        onClick={() => setNewsDateFilter("")}
                      >
                        Tampilkan semua berita
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-4">
                  {filteredNews.map((news) => {
                    if (!news) return null;
                    return (
                      <div key={news.id_berita} className="bg-white dark:bg-[#131c33] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4.5 shadow-xs flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-sm font-bold text-slate-855 dark:text-slate-100 m-0 leading-tight">{news.judul}</h4>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 m-0 flex items-center gap-1 font-semibold">
                              <CalendarDays size={12} />
                              {news.tanggal ? safeDate(news.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
                            </p>
                          </div>
                          {news.created_by_role && news.created_by_role !== "warga" && (
                            <span className="text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
                              {news.created_by_role}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs text-slate-655 dark:text-slate-350 m-0 leading-relaxed line-clamp-3">
                          {news.konten}
                        </p>
                        
                        <button
                          type="button"
                          className="w-full mt-1.5 inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl py-2.5 text-xs font-bold cursor-pointer transition-colors"
                          onClick={() => openNewsDetail(news)}
                        >
                          <MessageCircle size={14} />
                          Baca Selengkapnya & Diskusi
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========== STANDALONE VIEW: TAMBAH BERITA (Admin Only) ========== */}
      {openSheet === "tambahBerita" && (
        <div className="fixed inset-0 z-[60] w-full bg-slate-50 dark:bg-[#0b1329] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm">
            <button
              type="button"
              className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-655 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-700/60 active:scale-95"
              onClick={() => setOpenSheet("berita")}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Publikasi Berita Baru</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Tulis berita atau pengumuman resmi pengurus RT/RW</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            <form className="bg-white dark:bg-[#131c33] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 flex flex-col gap-4 shadow-xs" onSubmit={handlePublishNews}>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Judul Berita</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Masukkan judul berita atau pengumuman"
                  value={newsForm.judul}
                  onChange={(e) => setNewsForm({ ...newsForm, judul: e.target.value })}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Isi Berita</label>
                <textarea
                  className={`${inputCls} resize-y`}
                  rows="5"
                  placeholder="Tulis isi berita atau pengumuman selengkapnya..."
                  value={newsForm.konten}
                  onChange={(e) => setNewsForm({ ...newsForm, konten: e.target.value })}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-[13px] border-none cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm mt-2 active:scale-95"
                disabled={publishingNews}
              >
                <Send size={14} />
                {publishingNews ? "Memublikasikan..." : "Publikasi Sekarang"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ========== STANDALONE VIEW: NEWS DETAIL ========== */}
      {openSheet === "newsDetail" && selectedNews && (
        <div className="fixed inset-0 z-[60] w-full bg-slate-50 dark:bg-[#0b1329] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm z-10">
            <button
              type="button"
              className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-655 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-205 dark:hover:bg-slate-700/60 active:scale-95"
              onClick={() => setOpenSheet("berita")}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 truncate">Detail Informasi</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Baca pengumuman & diskusi antar tetangga</p>
            </div>
          </div>

          {/* Scrollable container for news content + chat comments */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* News content block */}
            <div className="p-5 flex flex-col gap-3.5 bg-white dark:bg-[#131c33] border-b border-slate-200/60 dark:border-slate-800/60 shadow-xxs">
              <h2 className="text-base font-extrabold text-slate-855 dark:text-slate-100 m-0 leading-snug">{selectedNews.judul}</h2>
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                <span className="flex items-center gap-1">
                  <CalendarDays size={12} />
                  {selectedNews.tanggal ? safeDate(selectedNews.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
                </span>
                {selectedNews.created_by_role && (
                  <span className="text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
                    Pengurus {selectedNews.created_by_role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-755 dark:text-slate-350 m-0 leading-relaxed whitespace-pre-wrap font-medium">
                {selectedNews.konten}
              </p>
            </div>
            {/* Area Tanya Jawab Container */}
            <div className="flex-1 flex flex-col min-h-0 px-5 pb-5 pt-2 overflow-hidden">
              <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-205 m-0 flex items-center gap-1.5 uppercase tracking-wider">
                  <MessageCircle size={15} className="text-blue-500" />
                  Tanya Jawab Berita
                </p>
                {!loadingReplies && newsReplies.length > 0 && (
                  <span className="text-[10px] font-extrabold bg-blue-50 dark:bg-blue-955/40 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/50">
                    {newsReplies.length} Komentar
                  </span>
                )}
              </div>

              {/* Chat Feed & Input Box Container */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#efeae2] dark:bg-[#0b141a] rounded-2xl p-4 border border-slate-200/50 dark:border-slate-850/50 shadow-inner">
                {/* Scrollable Comments List */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  {loadingReplies ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <RefreshCw size={24} className="text-gray-400 animate-spin" />
                      <span className="text-[12px] text-gray-555">Memuat tanya jawab...</span>
                    </div>
                  ) : newsReplies.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <div className="bg-white/95 dark:bg-[#1f2c34]/95 rounded-xl px-4.5 py-2.5 text-[11px] text-gray-555 dark:text-gray-400 max-w-[85%] shadow-sm border border-gray-100 dark:border-transparent">
                        Belum ada obrolan. Gunakan form di bawah untuk bertanya jawab terkait berita ini.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {(() => {
                        let lastDateHeader = null;
                        return newsReplies.map((reply) => {
                          if (!reply) return null;
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
                                  <span className="bg-white/90 dark:bg-[#1f2c34]/90 text-gray-555 dark:text-gray-400 text-[10px] font-extrabold uppercase px-3 py-1 rounded-lg shadow-sm border border-gray-150/50 dark:border-transparent backdrop-blur-xs tracking-wider">
                                    {currentDateHeader}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`flex flex-col gap-0.5 max-w-[85%] rounded-[18px] px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.1)] ${
                                  isOwn
                                    ? "self-end bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100 rounded-tr-none ml-auto border border-[#e1f5fe]/10 dark:border-transparent"
                                    : "self-start bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-tl-none mr-auto border border-gray-100 dark:border-transparent"
                                }`}
                              >
                                {!isOwn && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-655 dark:text-blue-400 mb-0.5">
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
                                  <div className="text-[9px] font-extrabold text-red-655 dark:text-red-400 uppercase tracking-wide self-end mb-0.5">
                                    Anda ({reply.role_pengirim})
                                  </div>
                                )}
                                {isOwn && (!reply.role_pengirim || reply.role_pengirim === "warga") && (
                                  <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide self-end mb-0.5">
                                    Anda
                                  </span>
                                )}
                                <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap break-words">{reply.isi_balasan}</p>
                                <span className="text-[9px] text-gray-555 dark:text-gray-555 shrink-0">
                                  {reply.timestamp ? safeDate(reply.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* Reply Form placed directly below the Chat Feed inside the container */}
                <div className="mt-3 pt-2 border-t border-slate-200/40 dark:border-slate-800/80 shrink-0">
                  <form onSubmit={handleSendReply} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-white dark:bg-[#1b2641] border border-slate-200 dark:border-[#2c3c5e] text-slate-950 dark:text-slate-100 rounded-full px-4 py-2 text-[12px] outline-none transition-colors focus:bg-white dark:focus:bg-[#1b2641] focus:border-blue-400"
                      placeholder="Ketik pesan balasan..."
                      value={replyForm}
                      onChange={(e) => setReplyForm(e.target.value)}
                      disabled={sendingReply}
                      required
                    />
                    <button
                      type="submit"
                      className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full border-none cursor-pointer flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 active:scale-90"
                      disabled={sendingReply || !replyForm.trim()}
                    >
                      <Send size={14} className="text-white" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
       {/* ========== STANDALONE VIEW: PANTAUAN ========== */}
      {openSheet === "pantauan" && (
        <div className="fixed inset-0 z-[60] w-full bg-slate-50 dark:bg-[#0b1329] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm">
            <button
              type="button"
              className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-655 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-205 dark:hover:bg-slate-700/60 active:scale-95"
              onClick={closeSheet}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Pantau Keluhan Warga</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Daftar laporan pengaduan hunian yang diajukan warga</p>
            </div>
          </div>

          {/* Body content */}
          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
            {/* Refresh */}
            <button
              className="inline-flex items-center justify-center gap-2 text-[12px] font-bold text-slate-605 dark:text-slate-300 bg-slate-150 dark:bg-slate-800 rounded-xl py-2.5 border-none cursor-pointer hover:bg-slate-205 dark:hover:bg-slate-750 transition-colors w-full shrink-0 active:scale-[0.99]"
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Memuat..." : "Muat Ulang Laporan"}
            </button>

            {loading && <Skeleton />}
            {!loading && tickets.length === 0 && (
              <div className="border border-dashed border-slate-300 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-[#131c33] p-5 text-center">
                <p className="text-sm font-bold m-0 mb-1 text-slate-850 dark:text-slate-100">Tidak ada tiket</p>
                <span className="text-xs text-slate-500 dark:text-slate-400">Daftar pantauan akan terisi ketika ada laporan masuk.</span>
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              {tickets.map((ticket) => {
                if (!ticket) return null;
                const isOpenStatus = ticket.status === "open";
                const isProsesStatus = ticket.status === "proses";
                const borderClr = isOpenStatus ? "border-l-[#f59e0b]" : isProsesStatus ? "border-l-[#3b82f6]" : "border-l-[#10b981]";
                
                return (
                  <button
                    key={ticket.id_tiket}
                    type="button"
                    className={`w-full text-left cursor-pointer transition-all duration-200 hover:shadow-xs hover:border-slate-300/80 dark:hover:border-slate-700/80 border border-slate-100 dark:border-slate-800/80 border-l-4 ${borderClr} rounded-xl bg-white dark:bg-[#131c33] shadow-xs p-3 flex flex-col gap-2 active:scale-[0.99]`}
                    onClick={() => openTicketDetail(ticket)}
                  >
                    {/* Header Row: Category + Ticket ID + Date */}
                    <div className="flex justify-between items-center w-full gap-2 shrink-0 select-none">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {ticket.kategori}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                        <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                          #{ticket.id_tiket ? ticket.id_tiket.slice(-5).toUpperCase() : ""}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Clock3 size={10} className="stroke-[2.5]" />
                        {safeDate(ticket.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </div>

                    {/* Footer Section: Reporter & Status Badge (Clean, line-free design) */}
                    <div className="flex items-center justify-between w-full shrink-0 select-none text-[10px]">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        Pelapor:{" "}
                        <span className="ml-1 bg-slate-50 dark:bg-slate-800/80 text-slate-655 dark:text-slate-355 font-bold px-1.5 py-0.5 rounded text-[9px] border border-slate-100/50 dark:border-transparent">
                          {ticket.id_user_pelapor || "Warga"}
                        </span>
                      </span>
                      
                      <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold border ${
                        isOpenStatus ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20" :
                        isProsesStatus ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20" :
                        "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========== STANDALONE VIEW: TICKET DETAIL ========== */}
      {openSheet === "ticketDetail" && selectedTicket && (
        <div className="fixed inset-0 z-[60] w-full bg-slate-50 dark:bg-[#0b1329] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm z-10">
            <button
              type="button"
              className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-655 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-205 dark:hover:bg-slate-700/60 active:scale-95"
              onClick={() => {
                if (tickets.length > 3) {
                  setOpenSheet("pantauan");
                } else {
                  closeSheet();
                }
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 truncate">Detail Laporan Warga</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Rincian informasi keluhan, aspirasi, dan saran hunian</p>
            </div>
          </div>

          {/* Constrained layout body container */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Complaint Card Wrapper */}
            <div className="p-5 pb-0 shrink-0 flex flex-col gap-4">
              {/* Dynamic Visual Status Timeline */}
              <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#131c33] border border-slate-100 dark:border-slate-800/80 rounded-2xl select-none text-[11px] font-bold shadow-xxs relative">
                {/* Absolute background track line centered mathematically at 30px */}
                <div className="absolute left-[52px] right-[52px] top-[30px] h-[2px] bg-slate-100 dark:bg-slate-800/60 z-0">
                  {/* Dynamic progress fill */}
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: selectedTicket.status === "open" ? "0%" : selectedTicket.status === "proses" ? "50%" : "100%"
                    }}
                  />
                </div>
                
                {/* Step 1 */}
                <div className="flex flex-col items-center gap-1.5 z-10">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    selectedTicket.status === "open"
                      ? "bg-amber-500 border-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                      : "bg-emerald-500 border-emerald-500 text-white"
                  }`}>
                    {selectedTicket.status === "open" ? <Clock3 size={11} className="stroke-[2.5]" /> : <CheckCircle size={11} className="stroke-[2.5]" />}
                  </div>
                  <span className={`text-[9px] uppercase tracking-wider ${
                    selectedTicket.status === "open" ? "text-amber-600 dark:text-amber-400 font-black" : "text-slate-400 dark:text-slate-500 font-semibold"
                  }`}>Diajukan</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center gap-1.5 z-10">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    selectedTicket.status === "proses"
                      ? "bg-blue-500 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.35)] animate-pulse"
                      : selectedTicket.status === "done"
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white dark:bg-[#131c33] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                  }`}>
                    {selectedTicket.status === "done" ? <CheckCircle size={11} className="stroke-[2.5]" /> : <RefreshCw size={11} className={`stroke-[2.5] ${selectedTicket.status === "proses" ? "animate-spin" : ""}`} />}
                  </div>
                  <span className={`text-[9px] uppercase tracking-wider ${
                    selectedTicket.status === "proses"
                      ? "text-blue-600 dark:text-blue-400 font-black"
                      : selectedTicket.status === "done"
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : "text-slate-400 dark:text-slate-500 font-semibold"
                  }`}>Diproses</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center gap-1.5 z-10">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    selectedTicket.status === "done"
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                      : "bg-white dark:bg-[#131c33] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                  }`}>
                    <CheckCircle size={11} className="stroke-[2.5]" />
                  </div>
                  <span className={`text-[9px] uppercase tracking-wider ${
                    selectedTicket.status === "done" ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-slate-400 dark:text-slate-500 font-semibold"
                  }`}>Selesai</span>
                </div>
              </div>

              {/* Ringkasan Keluhan Card */}
              <div className="bg-white dark:bg-[#131c33] border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs relative overflow-hidden">
                {/* Header: Category Badge + Status Badge */}
                <div className="flex justify-between items-center w-full shrink-0 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {selectedTicket.kategori}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                      #{selectedTicket.id_tiket ? selectedTicket.id_tiket.slice(-5).toUpperCase() : ""}
                    </span>
                  </div>
                  
                  <span className={`px-2.5 py-0.75 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                    selectedTicket.status === "open" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20" :
                    selectedTicket.status === "proses" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20" :
                    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
                  }`}>{selectedTicket.status}</span>
                </div>
                
                {/* Main Content: Description */}
                <div className="border-l-2 border-indigo-500/30 pl-3.5 my-1">
                  <p className="m-0 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 font-medium font-sans whitespace-pre-wrap">
                    {selectedTicket.deskripsi}
                  </p>
                </div>

                {/* Attachment Image (if any) */}
                {selectedTicket.url_foto_kondisi && (
                  <div className="mt-1 relative overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-xxs group cursor-pointer"
                       onClick={() => window.open(selectedTicket.url_foto_kondisi, '_blank')}>
                    <img src={selectedTicket.url_foto_kondisi} alt="Foto Kondisi" className="w-full max-h-[160px] object-cover transition-transform duration-300 group-hover:scale-102" />
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-opacity">
                      Klik untuk memperbesar gambar ↗
                    </div>
                  </div>
                )}

                {/* Metadata Grid (Reporter & Date) */}
                <div className="mt-1 pt-3 border-t border-dashed border-slate-150 dark:border-slate-800/80 grid grid-cols-2 gap-3 w-full shrink-0 select-none text-[10px] leading-normal font-semibold text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col gap-0.5">
                    <span>Pelapor:</span>
                    <span className="text-slate-700 dark:text-slate-355 font-bold bg-slate-50 dark:bg-slate-800/80 px-2 py-0.75 rounded border border-slate-100/50 dark:border-transparent w-fit">
                      {selectedTicket.id_user_pelapor || "Warga"}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-0.5 items-end">
                    <span>Diajukan pada:</span>
                    <span className="text-slate-700 dark:text-slate-355 font-bold">
                      {safeDate(selectedTicket.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* PIC Assignment Status Indicator */}
                <div className="mt-1 shrink-0 select-none">
                  {selectedTicket.id_petugas_pic ? (
                    <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/25 dark:border-blue-500/20 rounded-xl px-3.5 py-2.5 text-[11px] text-blue-700 dark:text-blue-400 flex justify-between items-center font-bold shadow-xxs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Petugas PIC:
                      </span>
                      <strong className="font-extrabold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-[10px]">
                        {selectedTicket.id_petugas_pic}
                      </strong>
                    </div>
                  ) : (
                    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/25 dark:border-amber-500/20 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-700 dark:text-amber-400 flex justify-between items-center font-bold shadow-xxs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Petugas PIC:
                      </span>
                      <strong className="font-extrabold uppercase tracking-wide bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded text-[10px]">
                        Belum Ditugaskan
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Area Tanya Jawab Container */}
            <div className="flex-1 flex flex-col min-h-0 px-5 pb-5 pt-2 overflow-hidden">
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-205 mb-2 flex items-center gap-1.5 px-1 uppercase tracking-wider shrink-0">
                <MessageCircle size={15} className="text-blue-500" />
                Tanya Jawab Keluhan
              </p>

              <div className="flex-1 flex flex-col min-h-0 bg-[#efeae2] dark:bg-[#0b141a] rounded-2xl p-4 border border-slate-200/50 dark:border-slate-850/50 shadow-inner">
                {/* Scrollable Chat Feed */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  {loadingTicketReplies ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <RefreshCw size={24} className="text-gray-400 animate-spin" />
                      <span className="text-[12px] text-gray-555">Memuat tanya jawab...</span>
                    </div>
                  ) : ticketReplies.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <div className="bg-white/95 dark:bg-[#1f2c34]/95 rounded-xl px-4.5 py-2.5 text-[11px] text-gray-555 dark:text-gray-400 max-w-[85%] shadow-sm border border-gray-100 dark:border-transparent">
                        Belum ada obrolan. Gunakan form di bawah untuk bertanya jawab terkait keluhan ini.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {(() => {
                        let lastDateHeader = null;
                        return ticketReplies.map((reply) => {
                          if (!reply) return null;
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
                                  <span className="bg-white/90 dark:bg-[#1f2c34]/90 text-gray-555 dark:text-gray-400 text-[10px] font-extrabold uppercase px-3 py-1 rounded-lg shadow-sm border border-gray-150/50 dark:border-transparent backdrop-blur-xs tracking-wider">
                                    {currentDateHeader}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`flex flex-col gap-0.5 max-w-[85%] rounded-[18px] px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.1)] ${
                                  isOwn
                                    ? "self-end bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100 rounded-tr-none ml-auto border border-[#e1f5fe]/10 dark:border-transparent"
                                    : "self-start bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-tl-none mr-auto border border-gray-100 dark:border-transparent"
                                }`}
                              >
                                {!isOwn && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-650 dark:text-blue-400 mb-0.5">
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
                                  <div className="text-[9px] font-extrabold text-red-650 dark:text-red-400 uppercase tracking-wide self-end mb-0.5">
                                    Anda ({reply.role_pengirim})
                                  </div>
                                )}
                                <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap break-words">{reply.isi_balasan}</p>
                                <span className="text-[9px] text-gray-555 dark:text-gray-555 shrink-0">
                                  {reply.timestamp ? safeDate(reply.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* Reply Form placed directly below the Q&A Chat Feed */}
                <div className="mt-3 pt-2 border-t border-slate-200/40 dark:border-slate-800/80 shrink-0">
                  {selectedTicket.status === "done" ? (
                    <div className="bg-white/80 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 rounded-xl py-2 px-3 text-center text-[11px] font-bold w-full shadow-xxs">
                      Laporan selesai & ditutup. Tanya jawab dinonaktifkan.
                    </div>
                  ) : (
                    <form onSubmit={handleSendTicketReply} className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-white dark:bg-[#1b2641] border border-slate-200 dark:border-[#2c3c5e] text-slate-950 dark:text-slate-100 rounded-full px-4 py-2 text-[12px] outline-none transition-colors focus:bg-white dark:focus:bg-[#1b2641] focus:border-blue-400"
                        placeholder="Ketik pesan balasan..."
                        value={ticketReplyForm}
                        onChange={(e) => setTicketReplyForm(e.target.value)}
                        disabled={sendingTicketReply}
                        required
                      />
                      <button
                        type="submit"
                        className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full border-none cursor-pointer flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 active:scale-90"
                        disabled={sendingTicketReply || !ticketReplyForm.trim()}
                      >
                        <Send size={14} className="text-white" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Officer/Admin Actions Form (Close & Done) placed as sticky bottom drawer */}
          {(user?.role === "admin" || user?.role === "petugas") && selectedTicket.status !== "done" && (
            <div className="safe-footer-padding bg-white dark:bg-[#131c33] border-t border-slate-100 dark:border-slate-800/80 shrink-0 flex flex-col gap-2 p-5 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
              {selectedTicket.status === "open" && (
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-extrabold py-3.5 px-4 rounded-xl text-[13px] border-none cursor-pointer transition-all hover:bg-blue-205 dark:hover:bg-blue-900/40 active:scale-95 shadow-xxs"
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

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </div>
  );
}

export default function ServiceHubWithBoundary() {
  return (
    <ServiceHubErrorBoundary>
      <ServiceHub />
    </ServiceHubErrorBoundary>
  );
}
