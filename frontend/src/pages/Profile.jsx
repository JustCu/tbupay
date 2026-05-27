import { useState } from "react";
import useStore from "../store/useStore";
import { Key, Info, LogOut, Home, Phone, ShieldCheck, Pencil, X, AlertCircle, Moon, Volume2, Globe } from "lucide-react";
import { updateUser } from "../application/use-cases/users/userUseCases";

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
  const [form, setForm] = useState({ nama: "", blok_rumah: "", no_hp: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
    <div className="pb-24 animate-[fadeIn_0.3s_ease-in-out]">
      <div className="py-4">
        <h2 className="text-xl font-bold m-0 text-gray-800 dark:text-gray-100">Profil Warga</h2>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 m-0">Kelola informasi pribadi dan pengaturan akun Anda</p>
      </div>

      <div
        className="relative overflow-hidden text-white rounded-2xl shadow-xl transition-all duration-300 select-none border border-white/10 w-full mb-6"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", // Darker premium slate
          aspectRatio: "1.586 / 1",
        }}
      >
        <div className="absolute right-[-20%] top-[-20%] w-[70%] h-[70%] bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-[-10%] bottom-[-10%] w-[50%] h-[50%] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Hologram subtle effect */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwbDR2NE00IDBMMCA0IiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')] opacity-50 pointer-events-none"></div>

        <div className="p-5 flex flex-col h-full w-full relative z-10 justify-between">
          
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
          <div className="flex gap-4 items-end mb-1 mt-auto pb-1">
            {/* Left: Photo */}
            <div className="shrink-0 flex flex-col gap-2">
              <div className="relative w-[72px] h-[90px] rounded-lg border-2 border-white/20 shadow-md overflow-hidden bg-slate-800 flex items-center justify-center shrink-0">
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
            <div className="flex-1 flex flex-col gap-2.5 pb-0.5">
              <div className="flex flex-col">
                <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Nama Lengkap</span>
                <span className="text-[15px] font-black tracking-wide text-white leading-none uppercase drop-shadow-xs truncate max-w-[170px]">
                  {user?.nama || "Nama Warga"}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Blok Rumah</span>
                  <span className="text-[11px] font-bold text-white uppercase leading-none truncate">{user?.blok_rumah || "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Status Warga</span>
                  <span className="text-[11px] font-bold uppercase leading-none text-emerald-400 truncate">{user?.status_warga || "Tetap"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="flex justify-between items-end border-t border-white/10 pt-2.5 mt-2">
            <div className="flex items-center gap-1.5 opacity-90">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span className="text-[9px] uppercase tracking-wider font-bold text-white">{user?.role || "warga"}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">ID Number</span>
              <span className="text-[10px] font-mono tracking-widest text-white/90">{user?.no_hp || "000000000"}</span>
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
          <div className="w-7.5 h-7.5 min-w-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#0f4c81] dark:bg-slate-800/60 dark:text-indigo-400">
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
            <div className="w-7.5 h-7.5 min-w-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#0f4c81] dark:bg-slate-800/60 dark:text-indigo-400">
              <Moon size={14} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold leading-snug transition-colors text-gray-800 dark:text-gray-200">Mode Gelap (Dark Mode)</span>
              <span className="text-[11px] mt-0.5 transition-colors text-gray-500 dark:text-gray-400">Aktifkan tema gelap pada aplikasi</span>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer border-none shrink-0 transition-all duration-300 ${
              isDarkMode ? "bg-primary" : "bg-gray-200"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                isDarkMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Row 3: Tentang Aplikasi TBU Pay */}
        <button
          className="w-full flex items-center gap-3.5 p-3.5 bg-transparent border-none cursor-pointer text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/40 dark:active:bg-slate-800/60"
          onClick={() =>
            showAlert(
              "TBU Pay v1.2.0\nDikembangkan untuk lingkungan perumahan.",
              { title: "Tentang Aplikasi", variant: "info" },
            )
          }
        >
          <div className="w-7.5 h-7.5 min-w-[30px] rounded-full flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#0f4c81] dark:bg-slate-800/60 dark:text-indigo-400">
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

      {/* Edit Profile Form BottomSheet Modal */}
      <div
        className={`fixed inset-0 z-[70] flex justify-center items-end bg-transparent pointer-events-none transition-colors duration-300 ${isEditOpen ? "bg-black/50 pointer-events-auto" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsEditOpen(false);
        }}
      >
        <div className={`w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-3xl p-[24px_20px] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col gap-[16px] max-h-[85vh] overflow-y-auto ${isEditOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 m-0">
              Edit Profil
            </h3>
            <button
              onClick={() => setIsEditOpen(false)}
              className="bg-gray-100 dark:bg-slate-800/60 border-none rounded-full p-2 cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {formError && (
            <div className="bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={14} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            {/* Avatar Upload Area */}
            <div className="flex flex-col gap-2 items-center mb-1">
              <div className="relative w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm">
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
              <label className="text-[12px] font-bold text-blue-600 cursor-pointer hover:underline">
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

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Nama Lengkap</label>
              <input
                className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
                type="text"
                placeholder="Contoh: Pak Budi Santoso"
                value={form.nama}
                onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">Blok Rumah (Read-Only)</label>
                <input
                  className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-100 text-[14px] outline-none font-sans box-border text-gray-400 cursor-not-allowed"
                  type="text"
                  value={form.blok_rumah}
                  disabled
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">No. WhatsApp</label>
                <input
                  className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={form.no_hp}
                  onChange={(e) => setForm((p) => ({ ...p, no_hp: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Password Baru (Opsional)</label>
              <input
                className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
                type="password"
                placeholder="Kosongkan jika tidak ingin mengubah password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-[#0f4c81] text-white border-none rounded-xl py-3 px-4 text-[14px] font-bold cursor-pointer w-full flex items-center justify-center gap-2 mt-2 transition-all hover:bg-[#0a3460] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
