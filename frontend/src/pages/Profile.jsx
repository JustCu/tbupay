import { useState } from "react";
import useStore from "../store/useStore";
import { Key, Info, LogOut, Home, Phone, ShieldCheck, Pencil, X, AlertCircle, Moon, Sun, Volume2, Globe, Bell, Terminal, Database, Cpu, Layers, ArrowLeft } from "lucide-react";
import { updateUser } from "../application/use-cases/users/userUseCases";
import NotificationModal from "../components/NotificationModal";

export default function Profile() {
  const user = useStore((state) => state.user);
  const login = useStore((state) => state.login);
  const logout = useStore((state) => state.logout);
  const showAlert = useStore((s) => s.showAlert);
  const showConfirm = useStore((s) => s.showConfirm);

  // App Settings from Zustand store
  const isDarkMode = useStore((state) => state.isDarkMode);
  const toggleDarkMode = useStore((state) => state.toggleDarkMode);
  const soundVibration = useStore((state) => state.soundVibration);
  const toggleSoundVibration = useStore((state) => state.toggleSoundVibration);
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [form, setForm] = useState({ nama: "", blok_rumah: "", no_hp: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const hasUnreadNotif = useStore((state) => state.hasUnreadNotif);
  const setHasUnreadNotif = useStore((state) => state.setHasUnreadNotif);

  const getInitials = (name) => {
    if (!name) return "W";
    const words = name.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const openEditProfile = () => {
    setForm({
      nama: user?.nama || "",
      blok_rumah: user?.blok_rumah || "",
      no_hp: user?.no_hp || "",
      password: "",
      url_foto_profil: user?.url_foto_profil || "",
      imageBase64: "",
    });
    setFormError("");
    setIsEditOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      setFormError("Nama lengkap wajib diisi.");
      return;
    }
    if (!form.no_hp.trim()) {
      setFormError("No. WhatsApp wajib diisi.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        id_user: user.id_user,
        nama: form.nama.trim(),
        blok_rumah: user.blok_rumah, // read-only
        no_hp: form.no_hp.trim(),
        role: user.role,
        status_warga: user.status_warga,
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }
      if (form.imageBase64) {
        payload.imageBase64 = form.imageBase64;
      }
      const res = await updateUser(payload);
      if (res.status === "success") {
        // Sync Zustand store
        login({
          ...user,
          nama: payload.nama,
          no_hp: payload.no_hp,
          url_foto_profil: res.url_foto_profil || user.url_foto_profil,
        });
        showAlert("Profil Anda berhasil diperbarui!", { variant: "success", title: "Sukses" });
        setIsEditOpen(false);
      } else {
        setFormError(res.message || "Gagal memperbarui profil.");
      }
    } catch (err) {
      setFormError("Terjadi kesalahan koneksi.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    showConfirm("Apakah Anda yakin ingin keluar?", logout, {
      title: "Keluar",
      variant: "warning",
      confirmLabel: "Keluar",
    });
  };

  return (
    <div className="pb-6 animate-[fadeIn_0.3s_ease-in-out]">
      <div className="pt-1 pb-4 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold m-0 text-gray-800 dark:text-gray-100">Profil Warga</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 m-0">Kelola informasi pribadi dan pengaturan akun Anda</p>
        </div>
        <div
          className="cursor-pointer relative transition-all duration-200 flex items-center justify-center p-2 text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white active:scale-95 shrink-0 mt-1"
          onClick={() => {
            setIsNotifOpen(true);
            setHasUnreadNotif(false);
          }}
        >
          <Bell size={24} className="stroke-[1.75] transition-colors duration-500 fill-amber-400 text-amber-500" />
          {hasUnreadNotif && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border border-white rounded-full animate-pulse z-10"></span>
          )}
        </div>
      </div>

      <div
        className="relative overflow-hidden text-white rounded-2xl shadow-xl transition-all duration-300 select-none border border-white/10 w-full mb-6 min-h-[205px] sm:min-h-[215px]"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", // Darker premium slate
          aspectRatio: "1.586 / 1",
        }}
      >
        <div className="absolute right-[-20%] top-[-20%] w-[70%] h-[70%] bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-[-10%] bottom-[-10%] w-[50%] h-[50%] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Hologram subtle effect */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwbDR2NE00IDBMMCA0IiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')] opacity-50 pointer-events-none"></div>

        <div className="p-4 sm:p-5 flex flex-col h-full w-full relative z-10 justify-between">
          
          {/* Top Header */}
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col">
              <span className="text-[16px] font-black tracking-widest text-white leading-none">TBU PAY</span>
              <span className="text-[8px] font-medium tracking-widest text-slate-400 mt-1 uppercase">Resident Identity Card</span>
            </div>
            {/* Simulating a smart card chip */}
            <div className="w-8 h-6 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-md opacity-90 shadow-inner flex flex-col justify-evenly items-center border border-yellow-600/30 overflow-hidden px-1">
              <div className="w-full h-[1px] bg-yellow-700/20"></div>
              <div className="w-full h-[1px] bg-yellow-700/20"></div>
            </div>
          </div>

          {/* Main Body */}
          <div className="flex gap-3 sm:gap-4 items-end mb-0.5 sm:mb-1 mt-auto pb-0.5 sm:pb-1">
            {/* Left: Photo */}
            <div className="shrink-0 flex flex-col gap-1.5 sm:gap-2">
              <div className="relative w-[68px] h-[85px] sm:w-[72px] sm:h-[90px] rounded-lg border-2 border-white/20 shadow-md overflow-hidden bg-slate-800 flex items-center justify-center shrink-0">
                {user?.url_foto_profil ? (
                  <img
                    src={user.url_foto_profil}
                    alt="Foto Profil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-3xl font-black tracking-widest shadow-inner">
                    {getInitials(user?.nama)}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Info */}
            <div className="flex-1 flex flex-col gap-1.5 sm:gap-2.5 pb-0.5">
              <div className="flex flex-col">
                <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Nama Lengkap</span>
                <span className="text-[14px] sm:text-[15px] font-black tracking-wide text-white leading-none uppercase drop-shadow-xs truncate max-w-[140px] xs:max-w-[170px]">
                  {user?.nama || "Nama Warga"}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div className="flex flex-col">
                  <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Blok Rumah</span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-white uppercase leading-none truncate">{user?.blok_rumah || "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Status Warga</span>
                  <span className={`text-[10px] sm:text-[11px] font-bold uppercase leading-none truncate ${
                    user?.status_warga === 'tetap' ? 'text-emerald-400' :
                    user?.status_warga === 'kontrak' ? 'text-indigo-400' :
                    user?.status_warga === 'kos' ? 'text-amber-400' :
                    'text-rose-400'
                  }`}>{user?.status_warga || "Tetap"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="flex justify-between items-end border-t border-white/10 pt-2 sm:pt-2.5 mt-1.5 sm:mt-2">
            <div className="flex items-center gap-1.5 opacity-90">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span className="text-[9px] uppercase tracking-wider font-bold text-white">{user?.role || "warga"}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Phone Number</span>
              <span className="text-[10px] font-mono tracking-widest text-white/90">{user?.no_hp || "-"}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Pengaturan & Fitur Header */}
      <h3 className="text-[15px] font-bold mt-6 mb-3 text-left m-0 transition-colors text-gray-800 dark:text-gray-200">
        Pengaturan & Fitur
      </h3>

      {/* Pengaturan & Tentang Aplikasi Card (Styled like Transaction History with dynamic theme state) */}
      <div className="border rounded-xl overflow-hidden shadow-xs transition-all duration-300 bg-white dark:bg-[#131c33] border-gray-100 dark:border-slate-800/80">
        {/* Row 1: Edit Profil */}
        <button
          className="w-full flex items-center gap-3.5 p-3.5 bg-transparent border-none border-b cursor-pointer text-left transition-colors border-gray-100 dark:border-slate-800/80 hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/40 dark:active:bg-slate-800/60"
          onClick={openEditProfile}
        >
          <div className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#0f4c81] dark:bg-slate-800/60 dark:text-indigo-400">
            <Pencil size={14} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-bold leading-snug transition-colors text-gray-800 dark:text-gray-200">Edit Profil</span>
            <span className="text-[11px] mt-0.5 transition-colors text-gray-500 dark:text-gray-400">Ubah nama lengkap, no. hp, & password akun</span>
          </div>
        </button>

        {/* Row 2: Mode Gelap (Dark Mode) */}
        <div className="flex items-center justify-between gap-3.5 p-3.5 border-b transition-colors border-gray-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <div className="flex items-center gap-3.5 text-left min-w-0">
            <div className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#0f4c81] dark:bg-slate-800/60 dark:text-indigo-400 relative overflow-hidden">
              <Sun
                size={14}
                className={`absolute transition-all duration-500 ${
                  isDarkMode ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
                }`}
              />
              <Moon
                size={14}
                className={`absolute transition-all duration-500 ${
                  isDarkMode ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                }`}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold leading-snug transition-colors text-gray-800 dark:text-gray-200">Mode Gelap (Dark Mode)</span>
              <span className="text-[11px] mt-0.5 transition-colors text-gray-500 dark:text-gray-400">Aktifkan tema gelap pada aplikasi</span>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`w-[50px] h-[28px] p-[2px] flex items-center rounded-full cursor-pointer border-none shrink-0 transition-all duration-300 relative ${
              isDarkMode ? "bg-indigo-600 dark:bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
            }`}
            aria-label="Toggle Mode Gelap"
          >
            <div
              className={`bg-white w-[24px] h-[24px] rounded-full shadow-md flex items-center justify-center relative transform transition-all duration-300 ${
                isDarkMode ? "translate-x-[22px]" : "translate-x-0"
              }`}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <Sun
                  size={13}
                  className={`absolute text-amber-500 transition-all duration-500 ${
                    isDarkMode ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
                  }`}
                />
                <Moon
                  size={12}
                  className={`absolute text-indigo-600 transition-all duration-500 ${
                    isDarkMode ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                  }`}
                />
              </div>
            </div>
          </button>
        </div>

        {/* Row 3: Tentang Aplikasi TBU Pay */}
        <button
          className="w-full flex items-center gap-3.5 p-3.5 bg-transparent border-none cursor-pointer text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/40 dark:active:bg-slate-800/60"
          onClick={() => setIsAboutOpen(true)}
        >
          <div className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#0f4c81] dark:bg-slate-800/60 dark:text-indigo-400">
            <Info size={14} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-bold leading-snug transition-colors text-gray-800 dark:text-gray-200">Tentang Aplikasi TBU Pay</span>
            <span className="text-[11px] mt-0.5 transition-colors text-gray-500 dark:text-gray-400">Informasi versi dan pengembang</span>
          </div>
        </button>
      </div>

      <button 
        className="bg-red-500 text-white border-none rounded-xl py-3.5 px-4 text-[14px] font-bold cursor-pointer w-full flex items-center justify-center gap-2 mt-6 transition-colors hover:bg-red-600 active:bg-red-700 shadow-sm" 
        onClick={handleLogout}
      >
        <LogOut size={18} />
        Keluar
      </button>

      {/* Edit Profile Form Full-Screen Modal */}
      <div
        className={`fixed inset-0 z-[70] w-full bg-white dark:bg-[#131c33] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden transition-all duration-300 ${
          isEditOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
          <button
            type="button"
            className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-600 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-700/60 active:scale-95 shrink-0"
            onClick={() => setIsEditOpen(false)}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 m-0 leading-tight">
              Edit Profil
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 m-0 mt-0.5 leading-normal">
              Perbarui foto profil, nama, no. hp, & sandi Anda
            </p>
          </div>
        </div>

        {/* Form Content Area - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 bg-gray-50 dark:bg-[#0b1020]">
          {formError && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3.5 rounded-2xl text-[13px] font-semibold border border-red-100 dark:border-red-500/20 leading-relaxed shadow-sm">
              <AlertCircle size={14} className="shrink-0 inline-block mr-1" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            {/* Avatar Upload Area */}
            <div className="flex flex-col gap-2 items-center mb-1 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
              <div className="relative w-20 h-20 rounded-full border-2 border-gray-100 dark:border-slate-750 overflow-hidden bg-gray-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                {form.imageBase64 || form.url_foto_profil ? (
                  <img
                    src={form.imageBase64 || form.url_foto_profil}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-3xl font-black">
                    {getInitials(form.nama || user?.nama)}
                  </div>
                )}
              </div>
              <label className="text-[12px] font-bold text-blue-600 dark:text-indigo-400 cursor-pointer hover:underline mt-1">
                Ubah Foto Profil
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setForm((p) => ({ ...p, imageBase64: reader.result }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
              <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Nama Lengkap</label>
              <input
                className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
                type="text"
                placeholder="Contoh: Pak Budi Santoso"
                value={form.nama}
                onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Blok (Read-Only)</label>
                <input
                  className="w-full min-h-[44px] py-2.5 px-4 bg-slate-100 dark:bg-slate-850/60 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-gray-400 dark:text-gray-500 outline-none cursor-not-allowed"
                  type="text"
                  value={form.blok_rumah}
                  disabled
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">No. WhatsApp</label>
                <input
                  className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={form.no_hp}
                  onChange={(e) => setForm((p) => ({ ...p, no_hp: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
              <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Password Baru (Opsional)</label>
              <input
                className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
                type="password"
                placeholder="Kosongkan jika tidak ingin diubah"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-[#0f4c81] text-white border-none rounded-xl py-3.5 px-4 text-[14px] font-bold cursor-pointer w-full flex items-center justify-center gap-2 mt-2 transition-all hover:bg-[#0a3460] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </form>
        </div>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />

      {/* About Application Popup */}
      <AboutAppPopup
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}

function AboutAppPopup({ isOpen, onClose }) {
  return (
    <div
      className={`fixed inset-0 z-[80] flex justify-center items-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-[440px] bg-white dark:bg-[#131c33] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800/80 overflow-hidden flex flex-col max-h-[85vh] transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        {/* Glowing Top Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 border-none rounded-full p-2 cursor-pointer text-gray-500 dark:text-gray-400 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Content Area - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 select-none custom-scrollbar">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mt-2">
            {/* Logo Icon from Login Screen */}
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`} 
              alt="TBU Pay Logo" 
              className="w-16 h-16 rounded-2xl mb-3 shadow-md border border-white/10 object-cover" 
            />
            
            <h3 className="text-[19px] font-black text-gray-800 dark:text-white m-0 tracking-wide">
              TBU PAY
            </h3>
            
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-slate-800/60 dark:text-indigo-400 border border-blue-100/50 dark:border-slate-700/30">
                v1.2.0
              </span>
              <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">•</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20">
                Production Ready
              </span>
            </div>

            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-2 max-w-[280px] leading-relaxed">
              Sistem manajemen iuran mandiri dan transparansi informasi warga perumahan.
            </p>
          </div>

          <div className="w-full h-[1px] bg-gray-100 dark:bg-slate-800/60"></div>

          <div className="flex flex-col gap-2">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              Visi & Misi Platform
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3.5 border border-slate-100/80 dark:border-slate-800/40">
              <p className="text-[12px] text-gray-700 dark:text-slate-300 m-0 leading-relaxed font-medium">
                Membangun transparansi finansial lingkungan perumahan secara inklusif, memudahkan pelaporan iuran warga secara akurat, serta memfasilitasi komunikasi pengurus perumahan dengan responsif dan modern.
              </p>
            </div>
          </div>

          {/* Fitur Utama */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              Fitur Unggulan
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              
              <div className="flex gap-3 items-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-colors duration-200">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-slate-800/60 dark:text-indigo-400 shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block leading-tight">
                    Pencatatan Iuran & Verifikasi
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-normal">
                    Pencatatan iuran bulanan warga terverifikasi aman oleh admin dengan upload bukti transfer terkompresi otomatis.
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-colors duration-200">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650 dark:bg-slate-800/60 dark:text-indigo-400 shrink-0">
                  <Layers size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block leading-tight">
                    Ekspor Laporan Keuangan A4
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-normal">
                    Unduh Laporan Keuangan resmi format PDF (Kop Surat, Ledger Mutasi Buku Iuran Rinci, Ringkasan Pos & Tanda Tangan).
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-colors duration-200">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-650 dark:bg-slate-800/60 dark:text-emerald-400 shrink-0">
                  <Cpu size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block leading-tight">
                    Pusat Informasi & Diskusi
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-normal">
                    Saluran pengumuman berita penting terintegrasi dengan diskusi antar warga dan obrolan grup reaktif (refresh 5 detik).
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-colors duration-200">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-slate-800/60 dark:text-rose-400 shrink-0">
                  <AlertCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block leading-tight">
                    Manajemen Keluhan (Ticketing)
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-normal">
                    Aspirasi warga dengan penugasan petugas PIC, ekstraksi kategori keluhan otomatis, serta pelacakan status penanganan.
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-colors duration-200">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-slate-800/60 dark:text-amber-400 shrink-0">
                  <Home size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block leading-tight">
                    Kartu Identitas Digital Warga
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-normal">
                    Tampilan Kartu Hunian Warga premium (Resident ID Card), menu kelola warga admin (list/tile grid) & pintasan chat WA.
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-colors duration-200">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-slate-800/60 dark:text-purple-400 shrink-0">
                  <Key size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block leading-tight">
                    Sesi Keamanan & Auto-Logout
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-normal">
                    Akses menu berbasis hak peranan (*role-based*) didukung sistem auto-logout setelah 7 hari tidak aktif demi keamanan data.
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="w-full h-[1px] bg-gray-100 dark:bg-slate-800/60"></div>

          {/* Spesifikasi Teknologi */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              Spesifikasi Teknologi
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/20">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-slate-800 dark:text-sky-400 shrink-0">
                  <Terminal size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase leading-none">Frontend</span>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 mt-0.5 leading-none">React 19 & Vite</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/20">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 shrink-0">
                  <Layers size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase leading-none">CSS Engine</span>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 mt-0.5 leading-none">TailwindCSS</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/20">
                <div className="p-1.5 rounded-lg bg-pink-50 text-pink-600 dark:bg-slate-800 dark:text-pink-400 shrink-0">
                  <Database size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase leading-none">Database & API</span>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 mt-0.5 leading-none">Google Sheets API</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/20">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-slate-800 dark:text-purple-400 shrink-0">
                  <Cpu size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase leading-none">State Engine</span>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 mt-0.5 leading-none">Zustand & SWR</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full h-[1px] bg-gray-100 dark:bg-slate-800/60"></div>

          {/* Tim Pengembang & Hak Cipta */}
          <div className="flex flex-col gap-2.5 items-center text-center mt-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                Pengembang Aplikasi
              </span>
              <span className="text-[13px] font-black text-slate-800 dark:text-slate-200 mt-0.5">
                Fathur R
              </span>
              <a 
                href="mailto:office.fathur@gmail.com" 
                className="text-[11px] font-bold text-blue-600 dark:text-indigo-400 hover:underline mt-0.5 block"
              >
                office.fathur@gmail.com
              </a>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal mt-2">
              © {new Date().getFullYear()} TBU Pay. Hak Cipta Dilindungi.
            </span>
          </div>

        </div>

        {/* Footer Button Action */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white border-none rounded-xl text-[12px] font-bold cursor-pointer transition-colors active:scale-[0.98] shadow-md shadow-blue-500/10"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
