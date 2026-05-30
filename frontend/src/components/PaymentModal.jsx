import { useState, useRef, useEffect } from "react";
import useStore from "../store/useStore";
import imageCompression from "browser-image-compression";
import { Camera, CalendarDays, X, Eye, ArrowLeft, Info, Copy } from "lucide-react";
import {
  createTransaction,
  addTransactionCategory,
  deleteTransactionCategory,
  getTransactionCategories,
  reorderTransactionCategories,
} from "../application/use-cases/transactions/transactionUseCases";

export default function PaymentModal({ isOpen, onClose }) {
  const user = useStore((state) => state.user);
  const showAlert = useStore((s) => s.showAlert);
  const showConfirm = useStore((s) => s.showConfirm);
  const isAdmin = user?.role === "admin";
  const [transactionType, setTransactionType] = useState("pemasukan");
  const [kategori, setKategori] = useState("Kas Rutin");

  // Format YYYY-MM for <input type="month">
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [bulan, setBulan] = useState(currentMonth);
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState(""); // New Notes field
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [sortingCategory, setSortingCategory] = useState(false);
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [uploadMeta, setUploadMeta] = useState({ name: "", size: "", type: "" });
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const fileInputRef = useRef(null);

  const defaultPemasukanOptions = [
    "Kas Rutin",
    "Sumbangan Sosial",
    "Kebersihan Ekstra",
  ];
  const defaultPengeluaranOptions = [
    "Operasional RT",
    "Perawatan Lingkungan",
    "Keamanan",
    "Kebersihan",
    "Lainnya",
  ];
  const [pemasukanOptions, setPemasukanOptions] = useState(
    defaultPemasukanOptions,
  );
  const [pengeluaranOptions, setPengeluaranOptions] = useState(
    defaultPengeluaranOptions,
  );

  const getActiveOptions = () =>
    transactionType === "pengeluaran" ? pengeluaranOptions : pemasukanOptions;

  const setActiveOptions = (newOptions) => {
    if (transactionType === "pengeluaran") {
      setPengeluaranOptions(newOptions);
    } else {
      setPemasukanOptions(newOptions);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await getTransactionCategories();
      if (res.status === "success") {
        const serverPemasukan = res.data?.pemasukan || [];
        const serverPengeluaran = res.data?.pengeluaran || [];
        setPemasukanOptions(
          serverPemasukan.length > 0
            ? serverPemasukan
            : defaultPemasukanOptions,
        );
        setPengeluaranOptions(
          serverPengeluaran.length > 0
            ? serverPengeluaran
            : defaultPengeluaranOptions,
        );
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadCategories();
    setTransactionType("pemasukan");
    setKategori("Kas Rutin");
    setBulan(currentMonth);
    setNominal("");
    setCatatan("");
    setPreviewUrl(null);
    setUploadMeta({ name: "", size: "", type: "" });
    setIsZoomOpen(false);
    setNewCategory("");
    setIsCategoryEditorOpen(false);
  }, [isOpen, currentMonth]);

  useEffect(() => {
    const opts = getActiveOptions();
    if (!opts.includes(kategori)) {
      setKategori(opts[0] || "");
    }
  }, [transactionType, pemasukanOptions, pengeluaranOptions]);

  useEffect(() => {
    setIsCategoryEditorOpen(false);
    setNewCategory("");
  }, [transactionType]);

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      showAlert("Nama kategori tidak boleh kosong.", {
        variant: "warning",
        title: "Validasi",
      });
      return;
    }

    setAddingCategory(true);
    try {
      const res = await addTransactionCategory({
        jenis_transaksi: transactionType,
        nama_kategori: trimmed,
        created_by_role: user?.role || "",
      });
      if (res.status === "success") {
        setNewCategory("");
        await loadCategories();
        setKategori(trimmed);
      } else {
        showAlert(res.message || "Gagal menambahkan kategori.", {
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
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = (name) => {
    const activeOptions = getActiveOptions();
    if (activeOptions.length <= 1) {
      showAlert("Kategori minimal harus tersisa 1 item.", {
        variant: "warning",
        title: "Tidak Bisa Dihapus",
      });
      return;
    }

    showConfirm(
      `Hapus kategori "${name}"?`,
      async () => {
        try {
          const res = await deleteTransactionCategory({
            jenis_transaksi: transactionType,
            nama_kategori: name,
            created_by_role: user?.role || "",
          });
          if (res.status === "success") {
            await loadCategories();
          } else {
            showAlert(res.message || "Gagal menghapus kategori.", {
              variant: "danger",
              title: "Gagal",
            });
          }
        } catch (err) {
          showAlert("Terjadi kesalahan koneksi.", {
            variant: "danger",
            title: "Kesalahan Koneksi",
          });
        }
      },
      {
        title: "Hapus Kategori",
        variant: "danger",
        confirmLabel: "Hapus",
      },
    );
  };

  const handleSortSave = async (orderedOptions) => {
    setSortingCategory(true);
    try {
      const res = await reorderTransactionCategories({
        jenis_transaksi: transactionType,
        ordered_names: orderedOptions,
        created_by_role: user?.role || "",
      });
      if (res.status !== "success") {
        showAlert(res.message || "Gagal menyimpan urutan kategori.", {
          variant: "danger",
          title: "Gagal",
        });
        await loadCategories();
      }
    } catch (err) {
      showAlert("Terjadi kesalahan koneksi saat menyimpan urutan.", {
        variant: "danger",
        title: "Kesalahan Koneksi",
      });
      await loadCategories();
    } finally {
      setSortingCategory(false);
    }
  };

  const moveOption = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    const options = [...getActiveOptions()];
    const [moved] = options.splice(fromIndex, 1);
    options.splice(toIndex, 0, moved);
    setActiveOptions(options);
    handleSortSave(options);
  };

  // Close when clicking outside
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleNominalChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value) {
      setNominal(new Intl.NumberFormat("id-ID").format(value));
    } else {
      setNominal("");
    }
  };

  const handleClearImage = () => {
    setPreviewUrl(null);
    setUploadMeta({ name: "", size: "", type: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi file gambar
    if (!file.type.startsWith("image/")) {
      showAlert("File harus berupa gambar (JPG, PNG, dll.).", {
        variant: "danger",
        title: "Format Salah",
      });
      return;
    }

    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);
      const sizeKb = Math.round(compressedFile.size / 1024);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
        setUploadMeta({
          name: file.name,
          size: `${sizeKb} KB`,
          type: file.type.split("/")[1].toUpperCase(),
        });
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Error compressing image:", error);
      showAlert("Gagal mengompres gambar.", {
        variant: "danger",
        title: "Gagal",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiresProof = !isAdmin || transactionType === "pemasukan";
    if (!kategori) {
      showAlert("Pilih kategori transaksi terlebih dahulu.", {
        variant: "warning",
        title: "Form Tidak Lengkap",
      });
      return;
    }
    if (!nominal || (requiresProof && !previewUrl)) {
      showAlert(
        requiresProof
          ? "Mohon lengkapi nominal dan bukti foto."
          : "Mohon lengkapi nominal transaksi.",
        {
          variant: "warning",
          title: "Form Tidak Lengkap",
        },
      );
      return;
    }

    setLoading(true);
    try {
      const numericNominal = parseInt(nominal.replace(/\./g, ""), 10);

      // Convert "2026-05" back to "Mei 2026" or just pass "2026-05"
      const dateObj = new Date(bulan + "-01");
      const bulanFormatted = dateObj.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });

      let ket = `${kategori} - ${bulanFormatted}`;
      if (catatan) {
        ket += ` (${catatan})`;
      }

      const res = await createTransaction({
        id_user: user?.id_user || "",
        jenis: transactionType,
        nominal: numericNominal,
        keterangan: ket,
        imageBase64: previewUrl,
        created_by_role: user?.role || "",
      });

      if (res.status === "success") {
        const successMessage =
          transactionType === "pengeluaran"
            ? "Pengeluaran berhasil dicatat ke kas perumahan."
            : isAdmin
              ? "Pemasukan berhasil dicatat ke kas perumahan."
              : "Bukti pembayaran berhasil dikirim dan menunggu verifikasi.";
        showAlert(successMessage, { variant: "success", title: "Berhasil" });
        onClose(); // close modal on success
      } else {
        showAlert("Gagal mengirim bukti pembayaran: " + res.message, {
          variant: "danger",
          title: "Gagal",
        });
      }
    } catch (err) {
      showAlert("Terjadi kesalahan koneksi.", {
        variant: "danger",
        title: "Kesalahan Koneksi",
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[60] w-full bg-white dark:bg-[#131c33] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden transition-all duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none translate-y-4"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm">
        <button
          type="button"
          className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-600 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-700/60 active:scale-95"
          onClick={onClose}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col flex-1">
          <h2 className="text-xl font-bold m-0 text-slate-800 dark:text-slate-100 leading-tight">
            {isAdmin ? "Input Kas Baru" : "Lapor Iuran Warga"}
          </h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-1 leading-normal">
            {isAdmin
              ? "Catat pemasukan & pengeluaran kas secara praktis"
              : "Lapor iuran bulanan untuk verifikasi"}
          </p>
        </div>
        <button
          type="button"
          className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95 shrink-0"
          onClick={() => setShowBankInfo(true)}
          title="Informasi Pembayaran"
        >
          <Info size={20} />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {isAdmin && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Tipe Transaksi</label>
                <div className="p-1 rounded-xl flex gap-1 bg-slate-100 dark:bg-[#1a2640]/80" role="tablist" aria-label="Tipe transaksi">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 border-none outline-none ${
                      transactionType === "pemasukan" 
                        ? "bg-emerald-500 text-white shadow-sm" 
                        : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    onClick={() => setTransactionType("pemasukan")}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 border-none outline-none ${
                      transactionType === "pengeluaran" 
                        ? "bg-rose-500 text-white shadow-sm" 
                        : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    onClick={() => setTransactionType("pengeluaran")}
                  >
                    Pengeluaran
                  </button>
                </div>
              </div>
            )}
 
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {transactionType === "pengeluaran" ? "Kategori Pengeluaran" : "Jenis Iuran"}
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    className="w-full min-h-[44px] px-4 py-3 rounded-xl text-[13px] font-semibold bg-slate-50 dark:bg-[#1b2641] border border-slate-200 dark:border-[#2c3c5e] outline-none font-sans text-slate-850 dark:text-slate-200 focus:bg-white dark:focus:bg-[#1b2641] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                  >
                    {getActiveOptions().map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
 
                {isAdmin && (
                  <button
                    type="button"
                    className="border-none rounded-xl bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-4 min-h-[44px] text-xs font-bold cursor-pointer transition-all duration-200 active:scale-95 shrink-0 flex items-center justify-center"
                    onClick={() => setIsCategoryEditorOpen(true)}
                  >
                    Kelola
                  </button>
                )}
              </div>
            </div>
 
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Bulan Penagihan</label>
              <div className="relative flex items-center bg-slate-50 dark:bg-[#1b2641] border border-slate-200 dark:border-[#2c3c5e] rounded-xl focus-within:bg-white dark:focus-within:bg-[#1b2641] focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all min-h-[44px]">
                <CalendarDays size={16} className="absolute left-4 text-slate-450 dark:text-slate-400 pointer-events-none stroke-[1.75]" />
                <input
                  type="month"
                  className="w-full min-h-[44px] pl-10 pr-4 bg-transparent border-none font-semibold text-slate-850 dark:text-slate-200 text-[13px] outline-none font-sans cursor-pointer"
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Periode iuran yang dilaporkan</span>
            </div>
 
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nominal Transaksi</label>
              <div className="flex items-center bg-slate-50 dark:bg-[#1b2641] border border-slate-200 dark:border-[#2c3c5e] rounded-xl px-4 focus-within:bg-white dark:focus-within:bg-[#1b2641] focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all min-h-[44px]">
                <span className="text-slate-500 dark:text-slate-400 font-extrabold text-[13px] pr-3 border-r border-slate-200 dark:border-[#2c3c5e]/80 mr-4 pointer-events-none">Rp</span>
                <input
                  type="text"
                  className="w-full min-h-[44px] bg-transparent border-none outline-none font-sans text-slate-850 dark:text-slate-200 text-[13px] font-bold pr-0 tabular-nums placeholder-slate-400 dark:placeholder-slate-400"
                  placeholder="0"
                  value={nominal}
                  onChange={handleNominalChange}
                  required
                />
              </div>
            </div>
 
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Catatan Tambahan (Opsional)</label>
              <textarea
                className="w-full min-h-[72px] px-4 py-3 rounded-xl text-[13px] bg-slate-50 dark:bg-[#1b2641] border border-slate-200 dark:border-[#2c3c5e] outline-none font-sans text-slate-850 dark:text-slate-200 resize-y focus:bg-white dark:focus:bg-[#1b2641] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder-slate-300 dark:placeholder-slate-600"
                placeholder="Contoh: Titip iuran sekalian buat Pak RT"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>
 
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {transactionType === "pengeluaran" && isAdmin
                  ? "Upload Lampiran (Opsional)"
                  : "Upload Bukti Transfer"}
              </label>
  
              {!previewUrl ? (
                <div
                  className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/10 dark:bg-indigo-500/5 hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/10 rounded-2xl py-8 px-6 flex flex-col items-center justify-center text-slate-450 dark:text-slate-400 cursor-pointer transition-all duration-300 active:scale-[0.99] gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={26} className="text-indigo-500 dark:text-indigo-400 stroke-[1.5]" />
                  <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 m-0 text-center">
                    Klik untuk ambil foto / galeri
                  </p>
                  {transactionType === "pengeluaran" && isAdmin && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 m-0 font-medium text-center">
                      Boleh dikosongkan jika tidak ada lampiran.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 m-0 font-medium text-center">Format JPG/PNG, maks. 500KB</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-indigo-50/30 dark:bg-indigo-500/5 border border-indigo-100/80 dark:border-indigo-550/20 rounded-2xl p-3 shadow-sm hover:border-indigo-200 transition-all duration-200">
                  {/* Thumbnail */}
                  <div 
                    className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 cursor-pointer shrink-0 group"
                    onClick={() => setIsZoomOpen(true)}
                  >
                    <img 
                      src={previewUrl} 
                      alt="Thumbnail Bukti" 
                      className="w-full h-full object-cover block group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] text-white font-extrabold bg-black/40 px-1 py-0.5 rounded shadow">ZOOM</span>
                    </div>
                  </div>
 
                  {/* Metadata */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 m-0 truncate leading-snug">
                      {uploadMeta.name || "bukti_pembayaran.jpg"}
                    </p>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-none">
                      <span>{uploadMeta.size || "0 KB"}</span>
                      <span className="text-slate-350 dark:text-slate-650">•</span>
                      <span>{uploadMeta.type || "JPG"}</span>
                      <span className="text-slate-350 dark:text-slate-650">•</span>
                      <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] text-emerald-700 dark:text-emerald-400">
                        Terkompresi ✓
                      </span>
                    </div>
                  </div>
 
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="border-none bg-indigo-100/60 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-lg p-2 cursor-pointer flex items-center justify-center transition-all active:scale-90"
                      onClick={() => setIsZoomOpen(true)}
                      title="Perbesar Bukti"
                    >
                      <Eye size={14} className="stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      className="border-none bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 dark:text-rose-455 rounded-lg p-2 cursor-pointer flex items-center justify-center transition-all active:scale-90"
                      onClick={handleClearImage}
                      title="Hapus Bukti"
                    >
                      <X size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              )}
  
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
 
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl mt-4 min-h-[46px] text-[12px] font-bold tracking-wide uppercase cursor-pointer w-full flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading
                ? "Menyimpan..."
                : transactionType === "pengeluaran" && isAdmin
                  ? "Simpan Pengeluaran"
                  : "Kirim Bukti Pembayaran"}
            </button>
          </form>
 
          {isAdmin && isCategoryEditorOpen && (
            <div
              className="absolute inset-0 z-[5] bg-slate-900/45 flex items-center justify-center p-4 max-h-[820px]:fixed max-h-[820px]:z-[120] max-h-[820px]:p-0 max-[480px]:items-stretch"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsCategoryEditorOpen(false);
              }}
            >
              <div className="w-full max-w-[420px] max-h-[78vh] overflow-y-auto bg-white dark:bg-[#131c33] rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-[0_14px_40px_rgba(15,23,42,0.2)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.5)] max-[480px]:max-w-none max-[480px]:max-h-none max-[480px]:h-full max-[480px]:rounded-none max-[480px]:border-none max-[480px]:shadow-none max-[480px]:p-4 max-[480px]:flex max-[480px]:flex-col">
                <div className="flex items-center justify-between mb-4 max-[480px]:sticky max-[480px]:top-0 max-[480px]:z-[2] max-[480px]:bg-white dark:max-[480px]:bg-[#131c33] max-[480px]:pb-2 max-[480px]:mb-2 max-[480px]:border-b max-[480px]:border-slate-200 dark:border-slate-800/80">
                  <h4 className="m-0 text-[13px] font-bold text-slate-900 dark:text-gray-100">
                    {transactionType === "pengeluaran" ? "Kelola Kategori Pengeluaran" : "Kelola Jenis Iuran"}
                  </h4>
                  <button
                    type="button"
                    className="border-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg w-7 h-7 inline-flex items-center justify-center cursor-pointer"
                    onClick={() => setIsCategoryEditorOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
 
                <p className="m-0 mb-3 text-[11px] text-slate-500 dark:text-gray-400 max-[480px]:mb-2">
                  Tambah, hapus, atau drag kategori untuk mengatur urutan dropdown.
                </p>
 
                <div className="grid grid-cols-[1fr_auto] gap-2 mb-3 max-[480px]:mb-2">
                  <input
                    type="text"
                    className="w-full min-h-[44px] px-4 py-3 rounded-xl text-[13px] bg-[#fcfdff] dark:bg-[#1b2641] border border-gray-200 dark:border-[#2c3c5e] outline-none font-sans text-gray-900 dark:text-gray-100 focus:border-blue-500"
                    placeholder={transactionType === "pengeluaran" ? "Tambah kategori pengeluaran" : "Tambah jenis iuran"}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <button
                    type="button"
                    className="border-none rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold px-4 min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={handleAddCategory}
                    disabled={addingCategory}
                  >
                    {addingCategory ? "..." : "Tambah"}
                  </button>
                </div>
 
                <div className="flex flex-col gap-2 mt-4 max-h-[42vh] overflow-y-auto pr-1">
                  {getActiveOptions().map((opt, idx) => (
                    <div
                      key={opt}
                      className={`flex items-center justify-between bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800/40 border rounded-xl p-3.5 cursor-grab transition-all ${
                        kategori === opt 
                          ? "border-indigo-300 dark:border-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-500/10" 
                          : "border-slate-100 dark:border-slate-800/80"
                      } ${dragIndex === idx ? "opacity-50" : ""}`}
                      onClick={() => setKategori(opt)}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        moveOption(dragIndex, idx);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[12px] font-bold text-slate-300 select-none tracking-tighter">::</span>
                        <span className="text-[12px] font-bold text-slate-700 dark:text-gray-250 truncate">{opt}</span>
                      </div>
                      <button
                        type="button"
                        className="border-none bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg p-1.5 cursor-pointer flex items-center justify-center transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(opt);
                        }}
                      >
                        <X size={14} className="stroke-[2.5]" />
                      </button>
                    </div>
                  ))}
                </div>
 
                {sortingCategory && (
                  <span className="inline-block mt-2.5 text-[11px] text-slate-500 dark:text-gray-400">
                    Menyimpan urutan...
                  </span>
                )}
              </div>
            </div>
          )}
      </div>

      {/* Zoom Lightbox Preview */}
      {isZoomOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[210] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-5 cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Top Bar */}
          <div className="w-full max-w-[440px] flex items-center justify-between text-white mb-4 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0 pr-4">
              <p className="text-[11px] font-extrabold m-0 truncate text-white">{uploadMeta.name || "bukti_pembayaran.jpg"}</p>
              <p className="text-[9px] font-bold text-gray-400 m-0 mt-0.5">{uploadMeta.size} • {uploadMeta.type} • Preview</p>
            </div>
            <button
              type="button"
              className="bg-white/10 hover:bg-white/20 text-white border-none rounded-full p-2 cursor-pointer flex items-center justify-center transition-all active:scale-90 shrink-0"
              onClick={() => setIsZoomOpen(false)}
            >
              <X size={16} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Full Image */}
          <div className="relative max-w-full max-h-[72vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewUrl} 
              alt="Bukti Transfer Zoom" 
              className="max-w-full max-h-[72vh] object-contain block" 
            />
          </div>

          {/* Guidance Info */}
          <p className="text-[10px] font-bold text-gray-400 mt-4 text-center max-w-[280px] leading-relaxed">
            Pastikan nominal transfer, nama rekening tujuan, tanggal, dan status berhasil terlihat jelas.
          </p>
        </div>
      )}

      {/* Bank Info Modal */}
      <div 
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ${
          showBankInfo ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`} 
        onClick={() => setShowBankInfo(false)}
      >
        <div 
          className={`w-full max-w-[340px] transition-transform duration-300 ${
            showBankInfo ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
          }`} 
          onClick={e => e.stopPropagation()}
        >
          {/* Header Action */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-base m-0 drop-shadow-md">Info Pembayaran</h3>
            <button
              type="button"
              className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full border-none cursor-pointer transition-colors active:scale-95"
              onClick={() => setShowBankInfo(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* BCA Card Design */}
          <div className="relative w-full aspect-[1.586/1] rounded-[20px] overflow-hidden shadow-2xl p-5 flex flex-col justify-between border border-white/10" style={{ background: "linear-gradient(135deg, #0b2265 0%, #1a41a8 50%, #0d52d6 100%)" }}>
             {/* Abstract Waves/Gradients */}
             <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4) 0%, transparent 50%)" }}></div>
             <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full border-[10px] border-white/10 pointer-events-none"></div>

             {/* decorative chip */}
             <div className="w-10 h-[30px] rounded-md bg-gradient-to-br from-[#ffd700] via-[#daa520] to-[#b8860b] mt-2 flex flex-col justify-evenly px-1.5 shadow-sm relative z-10 border border-black/20">
                <div className="h-px w-full bg-black/20"></div>
                <div className="h-px w-full bg-black/20"></div>
                <div className="h-px w-full bg-black/20"></div>
             </div>

             {/* logo */}
             <div className="absolute top-5 right-5 font-bold italic text-white text-2xl tracking-wider select-none" style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.3)" }}>
                BCA
             </div>

             {/* details */}
             <div className="mt-4 flex flex-col relative z-10">
                <div className="text-white/80 text-[10px] uppercase tracking-widest font-medium mb-1">Nomor Rekening</div>
                <div className="flex items-center justify-between">
                   <div className="font-mono text-white text-xl tracking-[0.1em] drop-shadow-md select-all">
                     2221 4916 71
                   </div>
                   <button 
                     type="button"
                     className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-2 cursor-pointer backdrop-blur-md border border-white/10 transition-colors active:scale-95"
                     onClick={() => {
                        navigator.clipboard.writeText("2221491671");
                        showAlert("Nomor rekening disalin", { variant: "success", title: "Berhasil" });
                     }}
                     title="Salin Nomor Rekening"
                   >
                     <Copy size={16} />
                   </button>
                </div>
                <div className="font-bold text-white text-[15px] tracking-[0.15em] uppercase mt-4 drop-shadow-md">
                  UTOYO
                </div>
             </div>
          </div>
          
          <div className="text-center text-white/70 text-xs mt-4 drop-shadow-md">
            Pastikan nama penerima sesuai sebelum transfer.
          </div>
        </div>
      </div>
    </div>
  );
}
