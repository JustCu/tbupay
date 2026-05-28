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
        className={`w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${heightClass} ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="w-[44px] h-[4px] rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mt-3 mb-1 shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button
            className="p-2 bg-gray-100 dark:bg-slate-800/60 rounded-full text-slate-600 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-gray-200 dark:hover:bg-slate-700/60"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
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

  const fetchNewsReplies = async (id_berita) => {
    if (!id_berita) return;
    setLoadingReplies(true);
    try {
      const res = await getNewsReplies(id_berita);
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

  const fetchTicketReplies = async (id_tiket) => {
    if (!id_tiket) return;
    setLoadingTicketReplies(true);
    try {
      const res = await getTicketReplies(id_tiket);
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
    await fetchTicketReplies(ticket.id_tiket);
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
        await fetchTicketReplies(selectedTicket.id_tiket);
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
    <div className="border border-gray-200 rounded-2xl bg-white p-4 flex flex-col gap-3">
      <span className="h-2.5 rounded-full bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:180%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite]" />
      <span className="h-2.5 rounded-full bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:180%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite] w-[62%]" />
    </div>
  );

  // -------- Form Field Styles --------
  const inputCls = "bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-[14px] font-sans text-gray-900 outline-none w-full focus:bg-white focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/10 transition-colors";
  const labelCls = "text-[11px] text-slate-500 uppercase tracking-[0.5px] font-bold";

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
          <button
            type="button"
            className="inline-flex items-center gap-1.5 border-none bg-blue-50/70 hover:bg-blue-100/90 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-blue-700 dark:text-indigo-400 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer active:scale-95 transition-all select-none"
            onClick={() => setOpenSheet("berita")}
          >
            <Newspaper size={12} />
            Lihat Semua
          </button>
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
          <button
            type="button"
            className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-all select-none"
            onClick={() => setOpenSheet("pantauan")}
          >
            <ClipboardList size={12} />
            Lihat Semua
          </button>
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
            
            return (
              <button
                key={ticket.id_tiket}
                type="button"
                className="w-full text-left cursor-pointer transition-all duration-300 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700/80 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-[#151f32] shadow-sm dark:shadow-none p-4 flex gap-4"
                onClick={() => openTicketDetail(ticket)}
              >
                {/* Status Indicator Icon Circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isOpen ? "bg-amber-500/10 text-[#78350f] dark:text-amber-400" :
                  isProses ? "bg-blue-500/10 text-[#1e3a8a] dark:text-blue-400" :
                  "bg-emerald-500/10 text-[#064e3b] dark:text-emerald-455"
                }`}>
                  {isOpen && <Clock3 size={18} className="stroke-[2.2]" />}
                  {isProses && <RefreshCw size={18} className="stroke-[2.2] animate-pulse" />}
                  {!isOpen && !isProses && <CheckCircle size={18} className="stroke-[2.2]" />}
                </div>

                {/* Content details */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-bold text-slate-850 dark:text-slate-100 leading-snug truncate">{ticket.kategori}</span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {safeDate(ticket.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  
                  <p className="m-0 text-xs font-normal text-slate-600 dark:text-slate-350 line-clamp-2 leading-relaxed">
                    {ticket.deskripsi}
                  </p>
                  
                  <div className="flex items-center justify-between mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 select-none">
                    <span>Pelapor: <span className="text-slate-700 dark:text-slate-200 font-extrabold">{ticket.id_user_pelapor}</span></span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-extrabold border ${
                      isOpen ? "bg-amber-50 dark:bg-amber-500/10 text-[#78350f] dark:text-amber-300 border-amber-200/50 dark:border-amber-500/20" :
                      isProses ? "bg-blue-50 dark:bg-blue-500/10 text-[#1e3a8a] dark:text-blue-300 border-blue-200/50 dark:border-blue-500/20" :
                      "bg-emerald-50 dark:bg-emerald-500/10 text-[#064e3b] dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-500/20"
                    }`}>{ticket.status}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========== BOTTOM SHEET: KELUHAN ========== */}
      <BottomSheet isOpen={openSheet === "keluhan"} onClose={closeSheet} title="Buat Keluhan Warga" heightClass="max-h-[88vh]">
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
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
            className="bg-red-600 hover:bg-red-700 text-white min-h-[48px] rounded-xl font-bold shadow-[0_8px_16px_rgba(239,68,68,0.25)] border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            onClick={handleKeluhanSubmit}
            disabled={loading || !keluhanForm.deskripsi.trim()}
          >
            {loading ? "Mengirim..." : "Kirim Keluhan"}
          </button>
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: SARAN ========== */}
      <BottomSheet isOpen={openSheet === "saran"} onClose={closeSheet} title="Kotak Saran & Masukan" heightClass="max-h-[88vh]">
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
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
        <div className="flex flex-col flex-1 min-h-0 bg-[#efeae2] dark:bg-[#0b141a] transition-colors duration-300">
          
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
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
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
                  const d = safeDate(n.tanggal);
                  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

            return filteredNews.map((news) => {
              if (!news) return null;
              return (
                <div key={news.id_berita} className="bg-white border border-gray-100 rounded-[14px] p-4 shadow-sm">
                  <div className="flex justify-between items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-150 m-0 leading-tight group-hover:text-primary transition-colors">{news.judul}</h4>
                    <p className="text-[11px] text-gray-400 m-0">{news.tanggal ? safeDate(news.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 text-blue-700 rounded-full px-2 py-1 text-[11px] font-semibold cursor-pointer"
                    onClick={() => openNewsDetail(news)}
                  >
                    <MessageCircle size={12} />
                    Detail & Balas
                  </button>
                </div>
              );
            });
          })()}
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: TAMBAH BERITA (Admin Only) ========== */}
      <BottomSheet isOpen={openSheet === "tambahBerita"} onClose={() => setOpenSheet("berita")} title="Publikasi Berita Baru" heightClass="h-fit max-h-[80vh]">
        <form className="p-5 flex flex-col gap-4 overflow-y-auto" onSubmit={handlePublishNews}>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Judul Berita</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              placeholder="Masukkan judul berita atau pengumuman"
              value={newsForm.judul}
              onChange={(e) => setNewsForm({ ...newsForm, judul: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Isi Berita</label>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] bg-slate-50 resize-y focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
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
          <div className="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500 bg-gray-100 border-none rounded-full px-3 py-1.5 w-fit cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => setOpenSheet("berita")}
            >
              ← Kembali ke Daftar Berita
            </button>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 m-0 leading-tight">{selectedNews.judul}</h3>
              <p className="text-[11px] text-gray-400 m-0">{selectedNews.tanggal ? safeDate(selectedNews.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
            </div>
            <p className="text-[14px] text-gray-600 m-0 leading-relaxed whitespace-pre-wrap">{selectedNews.konten}</p>
            
            <div className="mt-2 flex flex-col gap-3 border-t border-gray-100 dark:border-slate-800/80 pt-4 flex-1 min-h-0">
              <div className="flex items-center justify-between px-1">
                <p className="text-[14px] font-bold text-gray-800 m-0">Diskusi Warga</p>
                {!loadingReplies && newsReplies.length > 0 && (
                  <span className="text-[11px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                    {newsReplies.length} Pesan
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-[260px] overflow-y-auto bg-[#efeae2] dark:bg-[#0b141a] rounded-2xl p-4 flex flex-col gap-3.5 border border-gray-200/50 dark:border-slate-800/50 shadow-inner">
                {loadingReplies ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <RefreshCw size={22} className="text-gray-400 animate-spin" />
                    <span className="text-[12px] text-gray-500">Memuat komentar...</span>
                  </div>
                ) : newsReplies.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="bg-white/95 dark:bg-[#1f2c34]/95 rounded-xl px-4.5 py-2.5 text-[11px] text-gray-500 dark:text-gray-400 max-w-[85%] shadow-sm border border-gray-100 dark:border-transparent">
                      Belum ada tanggapan. Jadilah warga pertama yang berdiskusi terkait berita ini!
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(() => {
                      let lastDateHeader = null;
                      return newsReplies.map((reply) => {
                        if (!reply) return null;
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
                                <span className="text-[9px] text-gray-400/80 shrink-0">
                                  {reply.timestamp ? safeDate(reply.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
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
              <form onSubmit={handleSendReply} className="flex items-center gap-2 mt-1.5 pt-1.5 bg-white dark:bg-[#131c33] sticky bottom-0">
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
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <button
            className="inline-flex items-center justify-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors w-full"
            onClick={() => fetchTickets(true)}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>
 
          {loading && <Skeleton />}
          {!loading && tickets.length === 0 && (
            <div className="border border-dashed border-slate-300 rounded-2xl bg-white dark:bg-[#151f32] p-5 text-center">
              <p className="text-sm font-bold m-0 mb-1 text-slate-850 dark:text-slate-100">Tidak ada tiket</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">Daftar pantauan akan terisi ketika ada laporan masuk.</span>
            </div>
          )}
          {tickets.map((ticket) => {
            if (!ticket) return null;
            const isOpen = ticket.status === "open";
            const isProses = ticket.status === "proses";
            
            return (
              <button
                key={ticket.id_tiket}
                type="button"
                className="w-full text-left cursor-pointer transition-all duration-300 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700/80 bg-white dark:bg-[#151f32] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex gap-4"
                onClick={() => openTicketDetail(ticket)}
              >
                {/* Status Indicator Icon Circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isOpen ? "bg-amber-500/10 text-[#78350f] dark:text-amber-400" :
                  isProses ? "bg-blue-500/10 text-[#1e3a8a] dark:text-blue-400" :
                  "bg-emerald-500/10 text-[#064e3b] dark:text-emerald-455"
                }`}>
                  {isOpen && <Clock3 size={18} className="stroke-[2.2]" />}
                  {isProses && <RefreshCw size={18} className="stroke-[2.2] animate-pulse" />}
                  {!isOpen && !isProses && <CheckCircle size={18} className="stroke-[2.2]" />}
                </div>

                {/* Content details */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-bold text-slate-850 dark:text-slate-100 leading-snug truncate">[{ticket.kategori}]</span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {safeDate(ticket.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  
                  <p className="m-0 text-xs font-normal text-slate-600 dark:text-slate-350 line-clamp-3 leading-relaxed">
                    {ticket.deskripsi}
                  </p>
                  
                  <div className="flex items-center justify-between mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 select-none">
                    <span>Pelapor: <span className="text-slate-700 dark:text-slate-200 font-extrabold">{ticket.id_user_pelapor}</span></span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-extrabold border ${
                      isOpen ? "bg-amber-50 dark:bg-amber-500/10 text-[#78350f] dark:text-amber-300 border-amber-200/50 dark:border-amber-500/20" :
                      isProses ? "bg-blue-50 dark:bg-blue-500/10 text-[#1e3a8a] dark:text-blue-300 border-blue-200/50 dark:border-blue-500/20" :
                      "bg-emerald-50 dark:bg-emerald-500/10 text-[#064e3b] dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-500/20"
                    }`}>{ticket.status}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* ========== BOTTOM SHEET: TICKET DETAIL ========== */}
      <BottomSheet isOpen={openSheet === "ticketDetail" && !!selectedTicket} onClose={closeSheet} title="Detail Keluhan" heightClass="h-[88vh]">
        {selectedTicket && (
          <div className="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
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

              <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mt-2">
                <span>{safeDate(selectedTicket.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span>ID Pelapor: <span className="font-bold">{selectedTicket.id_user_pelapor}</span></span>
              </div>

              {selectedTicket.id_petugas_pic && (
                <div className="mt-1 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100/50 dark:border-blue-500/20 rounded-xl px-3 py-1.5 text-[11px] text-blue-700 dark:text-blue-400 flex justify-between items-center">
                  <span>PIC Petugas:</span>
                  <strong className="font-bold">{selectedTicket.id_petugas_pic}</strong>
                </div>
              )}
            </div>

            {/* Area Tanya Jawab (WhatsApp Style) */}
            <div className="flex flex-col gap-2 mt-2 flex-1 min-h-0">
              <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 m-0 flex items-center gap-1.5 px-1">
                <MessageCircle size={15} className="text-blue-500" />
                Tanya Jawab Keluhan
              </p>

              <div className="flex-1 min-h-[220px] overflow-y-auto bg-[#efeae2] dark:bg-[#0b141a] rounded-2xl p-4 flex flex-col gap-3 border border-gray-200/50 dark:border-slate-800/50 shadow-inner">
                {loadingTicketReplies ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <RefreshCw size={24} className="text-gray-400 animate-spin" />
                    <span className="text-[12px] text-gray-500">Memuat tanya jawab...</span>
                  </div>
                ) : ticketReplies.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="bg-white/95 dark:bg-[#1f2c34]/95 rounded-xl px-4.5 py-2.5 text-[11px] text-gray-500 dark:text-gray-400 max-w-[85%] shadow-sm border border-gray-100 dark:border-transparent">
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
                              <span className="text-[9px] text-gray-400/80 shrink-0">
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

              {/* Form Balasan Chat */}
              {selectedTicket.status === "done" ? (
                <div className="bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 text-gray-500 dark:text-gray-400 rounded-xl py-3 px-4 text-center text-[12px] font-bold mt-1 shadow-sm">
                  Keluhan ini telah diselesaikan & ditutup. Tanya jawab dinonaktifkan.
                </div>
              ) : (
                <form onSubmit={handleSendTicketReply} className="flex items-center gap-2 mt-1 pt-1 bg-white dark:bg-[#131c33] sticky bottom-0">
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

export default function ServiceHubWithBoundary() {
  return (
    <ServiceHubErrorBoundary>
      <ServiceHub />
    </ServiceHubErrorBoundary>
  );
}
