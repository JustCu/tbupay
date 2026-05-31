import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Wallet, MessageSquare, User, Plus } from "lucide-react";
import useStore from "../store/useStore";
import PaymentModal from "../components/PaymentModal";
import {
  prefetchAdminLikelyRoutes,
  prefetchHomeLikelyRoutes,
  prefetchRoute,
} from "../routes/routePrefetch";


export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useStore((state) => state.user);

  const navItems = [
    {
      id: "home",
      path: "/",
      icon: Home,
      label: "Beranda",
      roles: ["warga", "petugas", "admin"],
    },
    {
      id: "cashflow",
      path: "/cashflow",
      icon: Wallet,
      label: "Keuangan",
      roles: ["warga", "petugas", "admin"],
    },
    {
      id: "service",
      path: "/service",
      icon: MessageSquare,
      label: "Layanan",
      roles: ["warga", "petugas", "admin"],
    },
    {
      id: "profile",
      path: "/profile",
      icon: User,
      label: "Profil",
      roles: ["warga", "petugas", "admin"],
    },
  ];

  // Filter nav items based on role
  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || "warga"),
  );

  // Insert the FAB in the middle (index 2)
  const leftNavItems = visibleNavItems.slice(0, 2);
  const rightNavItems = visibleNavItems.slice(2);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Listen for custom event dispatched from NotificationModal's "Bayar Sekarang"
  useEffect(() => {
    const handler = () => setIsPaymentModalOpen(true);
    window.addEventListener("open-payment-modal", handler);
    return () => window.removeEventListener("open-payment-modal", handler);
  }, []);

  useEffect(() => {
    if (location.pathname === "/") {
      if (user?.role === "admin") {
        prefetchAdminLikelyRoutes();
      } else {
        prefetchHomeLikelyRoutes();
      }
    }
  }, [location.pathname, user?.role]);

  const handleNavIntent = (itemId) => {
    if (
      itemId === "cashflow" ||
      itemId === "service" ||
      itemId === "profile" ||
      itemId === "adminVerifikasi" ||
      itemId === "adminUsers"
    ) {
      prefetchRoute(itemId);
    }
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav bg-white dark:bg-[#0f1829] border-t border-gray-100 dark:border-slate-800/80 flex justify-around items-start fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 px-2">
        {leftNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.id}
              className={`flex flex-col items-center justify-center w-full transition-colors ${isActive ? "text-blue-600" : "text-gray-400"}`}
              onMouseEnter={() => handleNavIntent(item.id)}
              onTouchStart={() => handleNavIntent(item.id)}
              onClick={() => navigate(item.path)}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} fill="none" />
              </div>
              <span 
                className={`text-[10px] mt-1 ${isActive ? "font-semibold" : "font-medium"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* FAB in Center */}
        {user?.role !== "petugas" && (
          <div className="flex justify-center w-full">
            <button
              className="relative -top-5 bg-blue-600 border-4 border-white shadow-[0_4px_10px_rgba(0,0,0,0.1)] w-14 h-14 rounded-full flex items-center justify-center text-white active:bg-blue-800 transition"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <Plus className="w-8 h-8" strokeWidth={2} />
            </button>
          </div>
        )}

        {rightNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.id}
              className={`flex flex-col items-center justify-center w-full transition-colors relative ${isActive ? "text-blue-600" : "text-gray-400"}`}
              onMouseEnter={() => handleNavIntent(item.id)}
              onTouchStart={() => handleNavIntent(item.id)}
              onClick={() => navigate(item.path)}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} fill="none" />
              </div>
              <span 
                className={`text-[10px] mt-1 ${isActive ? "font-semibold" : "font-medium"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />
    </div>
  );
}
