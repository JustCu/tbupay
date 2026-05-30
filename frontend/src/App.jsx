import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import useStore from "./store/useStore";
import MainLayout from "./layouts/MainLayout";
import DialogModal from "./components/DialogModal";
import { routeLoaders } from "./routes/routePrefetch";

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const Cashflow = lazy(routeLoaders.cashflow);
const ServiceHub = lazy(routeLoaders.service);
const Profile = lazy(routeLoaders.profile);
const AdminVerifikasi = lazy(routeLoaders.adminVerifikasi);
const AdminUserManagement = lazy(routeLoaders.adminUsers);

function PageFallback() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50/50 dark:bg-[#0b1329]/50 backdrop-blur-md p-6 max-w-[480px] mx-auto border-x border-slate-200 dark:border-slate-800/80">
      <div className="bg-white/80 dark:bg-[#131c33]/80 backdrop-blur-xl border border-white dark:border-slate-800/40 rounded-2xl p-6 flex flex-col items-center gap-3.5 shadow-lg max-w-[200px] w-full relative overflow-hidden">
        <div className="w-10 h-10 rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
        <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest animate-pulse">Memuat...</span>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const isDarkMode = useStore((state) => state.isDarkMode);

  useEffect(() => {
    // Apply persisted theme class to document element on startup & changes
    document.documentElement.classList.toggle("dark", isDarkMode);

    // Dynamically update meta theme-color tags to match the selected theme
    const themeColor = isDarkMode ? "#0b1329" : "#fafafa";
    
    // 1. Base theme-color meta tag
    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', themeColor);
    
    // 2. Adaptive prefers-color-scheme meta tags (if present)
    const lightMeta = document.querySelector('meta[name="theme-color"][media*="light"]');
    if (lightMeta) lightMeta.setAttribute('content', themeColor);
    
    const darkMeta = document.querySelector('meta[name="theme-color"][media*="dark"]');
    if (darkMeta) darkMeta.setAttribute('content', themeColor);
  }, [isDarkMode]);

  return (
    <Router>
      <DialogModal />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="cashflow" element={<Cashflow />} />
            <Route path="service" element={<ServiceHub />} />
            <Route path="admin/verifikasi" element={<AdminVerifikasi />} />
            <Route path="admin/users" element={<AdminUserManagement />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
