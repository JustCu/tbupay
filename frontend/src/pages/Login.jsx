import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { ShieldCheck, HelpCircle, Eye, EyeOff } from "lucide-react";
import { loginUser } from "../application/use-cases/auth/authUseCases";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const login = useStore((state) => state.login);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Harap isi Nomor Blok/Username dan Password");
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser({ username, password });
      if (result.status === "success") {
        login(result.user);
        navigate("/");
      } else {
        setError(
          result.message || "Kredensial tidak valid. Silakan coba lagi.",
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
    window.open(
      "https://wa.me/6281234567890?text=Halo%20Pengurus,%20saya%20lupa%20password%20TBU%20Pay",
      "_blank",
    );
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
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4.5 shadow-md"
            style={{
              background: "linear-gradient(135deg, #0a3460 0%, #0f4c81 100%)",
            }}
          >
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black mb-1.5 tracking-tight text-slate-800 dark:text-white">
            TBU PAY
          </h1>
          <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none m-0 mt-0.5">
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
        <form onSubmit={handleLogin} className="flex flex-col gap-4.5">
          
          {/* Username Input Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 select-none">
              Nomor Blok / Username
            </label>
            <input
              type="text"
              autoComplete="username"
              className="w-full min-h-[44px] py-2.5 px-4 bg-white dark:bg-[#131c33]/50 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-indigo-500/10 placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Contoh: A-12"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Password Input Field with Visibility Toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 select-none">
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
            className="w-full min-h-[46px] mt-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-none rounded-2xl text-[14px] font-extrabold cursor-pointer flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(37,99,235,0.18)] dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none" 
            disabled={loading}
          >
            {loading ? "Memverifikasi..." : "Masuk"}
          </button>
        </form>

        {/* Lupa Password Help Button */}
        <button 
          className="bg-transparent border-none text-slate-400 dark:text-slate-500 text-[12px] font-bold flex items-center justify-center gap-1.5 w-full mt-7 cursor-pointer transition-colors hover:text-blue-600 dark:hover:text-indigo-400 select-none" 
          onClick={handleHelp}
        >
          <HelpCircle size={15} />
          Bantuan Lupa Kata Sandi
        </button>
      </div>
    </div>
  );
}
