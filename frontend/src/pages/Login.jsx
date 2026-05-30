import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { ShieldCheck, HelpCircle, Eye, EyeOff, X, MessageCircle } from "lucide-react";
import { loginUser } from "../application/use-cases/auth/authUseCases";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const navigate = useNavigate();
  
  const login = useStore((state) => state.login);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Harap isi ID User dan kata sandi");
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser({ username, password });
      if (result.status === "success") {
        login(result.user);
        navigate("/");
      } else {
        const friendlyMessage =
          result.message === "Invalid credentials"
            ? "ID User atau Kata Sandi salah. Silakan coba lagi."
            : result.message;
        setError(
          friendlyMessage || "Gagal masuk. Silakan coba lagi."
        );
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi. Silakan coba lagi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleHelp = () => {
    const defaultMsg = `Halo Pengurus, saya lupa password TBU Pay.\nMohon bantuannya untuk reset kata sandi.\n\nID User / Blok Rumah: ${username || ""}`;
    setHelpMessage(defaultMsg);
    setShowHelpModal(true);
  };

  const handleSendHelp = () => {
    const encodedText = encodeURIComponent(helpMessage);
    window.open(`https://wa.me/6281999386550?text=${encodedText}`, "_blank");
    setShowHelpModal(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-[#090d16] transition-colors duration-300 overflow-hidden">
      
      {/* Dynamic Ambient Background Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-blue-500/10 dark:bg-indigo-500/5 filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 dark:bg-emerald-500/5 filter blur-3xl pointer-events-none" />
      
      {/* Main Minimalist Frameless Container */}
      <div className="w-full max-w-[360px] relative z-10 p-2 transition-all duration-300 flex flex-col">
        
        {/* Logo and Header Block */}
        <div className="text-center mb-8 select-none">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="TBU Pay Logo" className="w-16 h-16 rounded-2xl mx-auto mb-5 shadow-md" />
          <h1 className="text-3xl font-black mb-1 select-none tracking-wider bg-gradient-to-r from-[#0a3460] to-[#1565a8] dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
            TBU PAY
          </h1>
          <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none m-0 mt-1 select-none">
            Tata Kelola Hunian Terpadu
          </p>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3.5 rounded-2xl mb-6 text-[13px] font-semibold border border-red-100 dark:border-red-500/20 leading-relaxed shadow-sm animate-shake">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          
          {/* Username Input Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 select-none">
              ID User
            </label>
            <input
              type="text"
              autoComplete="username"
              className="w-full min-h-[44px] py-2.5 px-4 bg-white dark:bg-[#131c33]/50 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-indigo-500/10 placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Masukkan ID User Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Password Input Field with Visibility Toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 select-none">
              Kata Sandi
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full min-h-[44px] py-2.5 pl-4 pr-11 bg-white dark:bg-[#131c33]/50 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-indigo-500/10 placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer flex items-center justify-center p-1.5 rounded-full"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Primary Submit Button */}
          <button 
            type="submit" 
            className="w-full min-h-[46px] mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-none rounded-2xl text-[14px] font-extrabold tracking-wide cursor-pointer flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(37,99,235,0.18)] dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none" 
            disabled={loading}
          >
            {loading ? "Memverifikasi..." : "Masuk"}
          </button>
        </form>

        {/* Lupa Password Help Button */}
        <button 
          className="bg-transparent border-none text-slate-400 dark:text-slate-500 text-[12px] font-bold flex items-center justify-center gap-1.5 w-full mt-8 cursor-pointer transition-colors hover:text-blue-600 dark:hover:text-indigo-400 select-none" 
          onClick={handleHelp}
        >
          <HelpCircle size={15} />
          Bantuan Lupa Kata Sandi
        </button>

        {/* Minimalist Premium Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center gap-1 select-none text-center">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
            TBU Pay • v1.2.0
          </span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-normal max-w-[240px]">
            Perumahan Taman Bukit Unika (TBU)
          </span>
        </div>
      </div>

      {/* WhatsApp Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/60 backdrop-blur-xs animate-[fadeIn_0.2s_ease-in-out]">
          <div className="w-full max-w-[360px] bg-white dark:bg-[#131c33] rounded-3xl p-6 border border-slate-100 dark:border-slate-800/80 shadow-[0_12px_40px_rgba(0,0,0,0.15)] flex flex-col gap-4 animate-[scaleUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 m-0">
                  Bantuan WhatsApp
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800/60 border-none cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700/60 flex items-center justify-center transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1 text-left">
              <p className="text-[12px] text-gray-500 dark:text-gray-400 m-0 leading-relaxed">
                Pesan bantuan akan dikirim ke pengurus di nomor <strong>0819-9938-6550</strong>. Silakan sesuaikan isi pesan di bawah ini jika diperlukan:
              </p>
            </div>

            {/* Textarea Field */}
            <div className="flex flex-col gap-1.5 bg-gray-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800/50">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 select-none text-left">
                Isi Pesan Bantuan
              </label>
              <textarea
                className="w-full py-1.5 px-1 border-none bg-transparent font-sans text-sm text-slate-800 dark:text-slate-100 outline-none resize-none transition-all placeholder-slate-400 min-h-[100px] focus:ring-0 leading-relaxed text-left"
                placeholder="Tulis pesan bantuan Anda..."
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                className="py-3 px-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#131c33] text-[13px] font-extrabold text-gray-500 dark:text-gray-400 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 select-none active:scale-[0.98]"
                onClick={() => setShowHelpModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="py-3 px-4 rounded-2xl border-none bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-[13px] font-extrabold cursor-pointer transition-all shadow-[0_4px_12px_rgba(16,185,129,0.18)] select-none active:scale-[0.98] flex items-center justify-center gap-1.5"
                onClick={handleSendHelp}
              >
                Kirim WA
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
