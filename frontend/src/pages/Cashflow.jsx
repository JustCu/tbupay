import { useState, useEffect, useMemo, useRef } from "react";
import useStore from "../store/useStore";
import { TrendingUp, ArrowDownLeft, ArrowUpRight, Bell, ChevronLeft, ChevronRight, X, Filter, FileText, Download, Printer } from "lucide-react";
import { getTransactions } from "../application/use-cases/transactions/transactionUseCases";
import { getUsers } from "../application/use-cases/users/userUseCases";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import NotificationModal from "../components/NotificationModal";
import usePullToRefresh from "../hooks/usePullToRefresh";

const safeDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (typeof dateVal === 'string') return new Date(dateVal.replace(" ", "T"));
  return new Date(dateVal);
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const DOUGHNUT_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#94a3b8",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
  "#f97316",
];

const parseDate = (value) => {
  const date = safeDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPeriodTitle = (filter) => {
  const now = new Date();
  if (filter === "hariini") {
    return `Hari Ini, ${now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  if (filter === "mingguan") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    const startLabel = start.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    const endLabel = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${startLabel} - ${endLabel}`;
  }
  if (filter === "bulanan") {
    return now.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  }
  return `Tahun ${now.getFullYear()}`;
};

export default function Cashflow() {
  const isDarkMode = useStore((state) => state.isDarkMode);
  const [transactions, setTransactions] = useState(() => {
    try {
      const cachedTrx = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cachedTrx) {
        const entry = JSON.parse(cachedTrx);
        if (entry?.response?.status === "success" && Array.isArray(entry.response.data)) {
          return [...entry.response.data].sort(
            (a, b) => safeDate(b.timestamp) - safeDate(a.timestamp),
          );
        }
      }
    } catch (e) {
      console.error("Failed to load cashflow cache in state initializer:", e);
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cachedTrx = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cachedTrx) {
        const entry = JSON.parse(cachedTrx);
        if (entry?.response?.status === "success" && Array.isArray(entry.response.data) && entry.response.data.length > 0) {
          return false;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return true;
  });

  const [dataSource, setDataSource] = useState(() => {
    try {
      const cachedTrx = localStorage.getItem("tbu_pay_cache_v1:getTransactions:{}");
      if (cachedTrx) {
        const entry = JSON.parse(cachedTrx);
        if (entry?.response?.status === "success" && Array.isArray(entry.response.data) && entry.response.data.length > 0) {
          return "cache";
        }
      }
    } catch (e) {
      console.error(e);
    }
    return "network";
  });

  const [refreshing, setRefreshing] = useState(false);
  const hasUnreadNotif = useStore((state) => state.hasUnreadNotif);
  const setHasUnreadNotif = useStore((state) => state.setHasUnreadNotif);
  const [filter, setFilter] = useState("semua");
  const [isAllTrxOpen, setIsAllTrxOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const chartScrollRef = useRef(null);
  const [users, setUsers] = useState(() => {
    try {
      const cachedUsers = localStorage.getItem("tbu_pay_cache_v1:getUsers:{}");
      if (cachedUsers) {
        const entry = JSON.parse(cachedUsers);
        if (entry?.response?.status === "success" && Array.isArray(entry.response.data)) {
          return entry.response.data;
        }
      }
    } catch (e) {
      console.error("Failed to load users cache in state initializer:", e);
    }
    return [];
  });

  const fetchTransactions = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else {
      setLoading((prev) => (transactions.length > 0 ? false : true));
    }

    try {
      const [res, userRes] = await Promise.all([
        getTransactions(forceRefresh ? { forceRefresh: true } : {}),
        getUsers(forceRefresh ? { forceRefresh: true } : {}),
      ]);
      if (res?._meta?.source) {
        setDataSource(res._meta.source);
      }
      if (res.status === "success" && Array.isArray(res.data)) {
        const sortedData = [...res.data].sort(
          (a, b) => safeDate(b.timestamp) - safeDate(a.timestamp),
        );
        setTransactions(sortedData);
      }
      if (userRes.status === "success" && Array.isArray(userRes.data)) {
        setUsers(userRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const pull = usePullToRefresh({
    onRefresh: () => fetchTransactions(true),
    disabled: loading || refreshing,
  });

  const verifiedTransactions = useMemo(
    () =>
      transactions.filter((t) => String(t.status).toLowerCase() === "verified"),
    [transactions],
  );

  const {
    totalMasuk,
    totalKeluar,
    pengeluaranPerPos,
    barData,
    periodTitle,
    masukChange,
    keluarChange,
    netChange,
    labelPeriodText,
    beginningBalance,
    chronologicalLedger,
  } = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let pMasuk = 0;
    let pKeluar = 0;
    const posMap = {};

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    let currentStart, currentEnd;
    let prevStart, prevEnd;
    let periodLabel = "";

    if (filter === "hariini") {
      currentStart = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      currentEnd = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);

      prevStart = new Date(currentYear, currentMonth, currentDate - 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear, currentMonth, currentDate - 1, 23, 59, 59, 999);
      periodLabel = "kemarin";
    } else if (filter === "mingguan") {
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - 6);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);

      prevStart = new Date(now);
      prevStart.setDate(now.getDate() - 13);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(now);
      prevEnd.setDate(now.getDate() - 7);
      prevEnd.setHours(23, 59, 59, 999);
      periodLabel = "mgg lalu";
    } else if (filter === "bulanan") {
      currentStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      currentEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

      prevStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      periodLabel = "bln lalu";
    } else {
      currentStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      currentEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      prevStart = new Date(currentYear - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);
      periodLabel = "thn lalu";
    }

    verifiedTransactions.forEach((trx) => {
      const date = parseDate(trx.timestamp);
      if (!date) return;
      const nominal = Number(trx.nominal) || 0;

      if (date >= currentStart && date <= currentEnd) {
        if (trx.jenis === "pemasukan") {
          masuk += nominal;
        } else if (trx.jenis === "pengeluaran") {
          keluar += nominal;
          const pos = String(trx.keterangan || "Lainnya").trim() || "Lainnya";
          posMap[pos] = (posMap[pos] || 0) + nominal;
        }
      }

      if (date >= prevStart && date <= prevEnd) {
        if (trx.jenis === "pemasukan") {
          pMasuk += nominal;
        } else if (trx.jenis === "pengeluaran") {
          pKeluar += nominal;
        }
      }
    });

    const calcPctChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const changeMasuk = calcPctChange(masuk, pMasuk);
    const changeKeluar = calcPctChange(keluar, pKeluar);
    const net = masuk - keluar;

    let labels = [];
    const barDataMap = {};

    if (filter === "hariini") {
      labels = ["Hari Ini"];
    } else if (filter === "mingguan") {
      labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    } else if (filter === "bulanan") {
      labels = ["Mg 1", "Mg 2", "Mg 3", "Mg 4", "Mg 5"];
    } else {
      labels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
    }

    labels.forEach((l) => (barDataMap[l] = { m: 0, k: 0 }));

    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];

    verifiedTransactions.forEach((trx) => {
      const date = parseDate(trx.timestamp);
      if (!date) return;
      const nominal = Number(trx.nominal) || 0;

      if (date >= currentStart && date <= currentEnd) {
        let binLabel = "";
        if (filter === "hariini") {
          binLabel = "Hari Ini";
        } else if (filter === "mingguan") {
          binLabel = days[date.getDay()];
        } else if (filter === "bulanan") {
          const dateNum = date.getDate();
          if (dateNum <= 7) binLabel = "Mg 1";
          else if (dateNum <= 14) binLabel = "Mg 2";
          else if (dateNum <= 21) binLabel = "Mg 3";
          else if (dateNum <= 28) binLabel = "Mg 4";
          else binLabel = "Mg 5";
        } else {
          binLabel = months[date.getMonth()];
        }

        if (trx.jenis === "pemasukan") {
          if (barDataMap[binLabel]) barDataMap[binLabel].m += nominal;
        } else if (trx.jenis === "pengeluaran") {
          if (barDataMap[binLabel]) barDataMap[binLabel].k += nominal;
        }
      }
    });

    const computedBarData = {
      labels,
      datasets: [
        {
          label: "Pemasukan",
          data: labels.map((l) => barDataMap[l].m),
          backgroundColor: "#10b981",
          borderRadius: 6,
          barPercentage: 0.6,
        },
        {
          label: "Pengeluaran",
          data: labels.map((l) => barDataMap[l].k),
          backgroundColor: "#ef4444",
          borderRadius: 6,
          barPercentage: 0.6,
        },
      ],
    };

    // Calculate Beginning Balance (accumulated before currentStart)
    let beginningBalance = 0;
    verifiedTransactions.forEach((trx) => {
      const date = parseDate(trx.timestamp);
      if (!date) return;
      const nominal = Number(trx.nominal) || 0;
      if (date < currentStart) {
        if (trx.jenis === "pemasukan") {
          beginningBalance += nominal;
        } else if (trx.jenis === "pengeluaran") {
          beginningBalance -= nominal;
        }
      }
    });

    // Chronological Ledger (oldest to newest within currentStart and currentEnd)
    const reportTransactions = verifiedTransactions
      .filter((trx) => {
        const date = parseDate(trx.timestamp);
        return date && date >= currentStart && date <= currentEnd;
      })
      .sort((a, b) => safeDate(a.timestamp) - safeDate(b.timestamp));

    let currentRunningBalance = beginningBalance;
    const chronologicalLedger = reportTransactions.map((trx) => {
      const nominal = Number(trx.nominal) || 0;
      const isMasuk = trx.jenis === "pemasukan";
      currentRunningBalance += isMasuk ? nominal : -nominal;
      return {
        ...trx,
        runningBalance: currentRunningBalance,
      };
    });

    const sortedPos = Object.entries(posMap).sort((a, b) => b[1] - a[1]);

    return {
      totalMasuk: masuk,
      totalKeluar: keluar,
      pengeluaranPerPos: sortedPos,
      barData: computedBarData,
      periodTitle: getPeriodTitle(filter),
      masukChange: changeMasuk,
      keluarChange: changeKeluar,
      netChange: net,
      labelPeriodText: periodLabel,
      beginningBalance,
      chronologicalLedger,
    };
  }, [verifiedTransactions, filter]);

  useEffect(() => {
    if (chartScrollRef.current && barData?.labels?.length > 7) {
      // Focus on the current month initially on the scrollable chart
      setTimeout(() => {
        if (chartScrollRef.current) {
          const container = chartScrollRef.current;
          const currentMonth = new Date().getMonth();
          const totalMonths = barData.labels.length;
          const monthWidth = container.scrollWidth / totalMonths;
          
          // Calculate center position for the current month
          const targetCenter = (currentMonth + 0.5) * monthWidth;
          
          // scrollLeft to center the month inside the viewport
          const targetScrollLeft = targetCenter - container.clientWidth / 2;
          
          // Clamp scroll position to valid bounds
          container.scrollLeft = Math.max(
            0,
            Math.min(container.scrollWidth - container.clientWidth, targetScrollLeft)
          );
        }
      }, 100);
    }
  }, [barData]);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id_user] = u;
    });
    return map;
  }, [users]);

  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0].slice(0, 2).toUpperCase();
  };

  const globalTotalSaldo = useMemo(() => {
    return verifiedTransactions.reduce((acc, trx) => {
      const nominal = Number(trx.nominal) || 0;
      if (trx.jenis === "pemasukan") return acc + nominal;
      if (trx.jenis === "pengeluaran") return acc - nominal;
      return acc;
    }, 0);
  }, [verifiedTransactions]);

  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatYAxis = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, "") + "Jt";
    if (value >= 1000) return (value / 1000).toFixed(0) + "Rb";
    return value;
  };

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          font: { size: 10, weight: "bold" },
          color: isDarkMode ? "#cbd5e1" : "#4b5563",
        },
      },
      tooltip: {
        backgroundColor: "#1f2937",
        titleFont: { size: 11, weight: "bold" },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: function (context) {
            return ` ${context.dataset.label}: ${formatRupiah(context.raw)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: formatYAxis,
          font: { size: 9, weight: "medium" },
          color: isDarkMode ? "#94a3b8" : "#9ca3af",
        },
        grid: {
          color: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#f3f4f6",
          drawTicks: false,
        },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 9, weight: "medium" },
          color: isDarkMode ? "#94a3b8" : "#9ca3af",
        },
        border: { display: false },
      },
    },
  }), [isDarkMode]);

  const doughnutData = useMemo(() => {
    if (pengeluaranPerPos.length === 0) {
      return {
        labels: ["Belum ada data"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#e5e7eb"],
            borderWidth: 0,
            hoverOffset: 2,
          },
        ],
      };
    }

    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ef4444",
      "#14b8a6",
      "#f97316",
      "#94a3b8",
    ];

    return {
      labels: pengeluaranPerPos.map(([kategori]) => kategori),
      datasets: [
        {
          data: pengeluaranPerPos.map(([, nominal]) => nominal),
          backgroundColor: pengeluaranPerPos.map((_, idx) => colors[idx % colors.length]),
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  }, [pengeluaranPerPos]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#1f2937",
        titleFont: { size: 11, weight: "bold" },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: function (context) {
            const raw = Number(context.raw) || 0;
            const dataset = context.chart.data.datasets[context.datasetIndex];
            const total = dataset.data.reduce((sum, val) => sum + (Number(val) || 0), 0);
            const percentage = total > 0 ? Math.round((raw / total) * 100) : 0;
            return ` ${percentage}% • ${formatRupiah(raw)}`;
          },
        },
      },
    },
  }), []);

  const displayedTransactions = transactions.slice(0, 5);

  return (
    <div className="pb-6 animate-[fadeIn_0.3s_ease-in-out]" {...pull.bind}>
      {pull.showPullHint && (
        <div className={`sticky top-2 z-[31] mx-auto mb-2.5 w-fit px-3 py-[7px] rounded-full border text-xs font-semibold ${pull.isReady ? "border-green-300 bg-green-50 text-green-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}>
          {pull.isReady ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang"}
        </div>
      )}
      <CacheFallbackBadge source={dataSource} />
      
      <div className="pt-1 pb-4 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold m-0 text-gray-800 dark:text-gray-100">Laporan Keuangan</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 m-0">Pantau dan kelola arus kas warga secara real-time</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => setIsReportPreviewOpen(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 bg-[#0f4c81] text-white hover:bg-[#0a3460] disabled:opacity-60 disabled:cursor-not-allowed border-none rounded-[10px] p-[8px_14px] text-[12px] font-bold cursor-pointer transition-all active:scale-[0.97]"
          >
            <FileText size={14} />
            Ekspor
          </button>
          <div
            className="cursor-pointer relative transition-all duration-200 flex items-center justify-center p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full active:scale-95 shrink-0"
            onClick={() => {
              setIsNotifOpen(true);
              setHasUnreadNotif(false);
            }}
          >
            <Bell 
              size={24} 
              className={`stroke-[1.75] transition-all duration-500 ${(loading || refreshing) ? "text-gray-400 dark:text-gray-500 fill-transparent" : "fill-amber-400 text-amber-500"}`} 
            />
            {hasUnreadNotif && !loading && !refreshing && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border border-white rounded-full animate-pulse z-10"></span>
            )}
          </div>
        </div>
      </div>

      {/* Periode Tab Switcher (Laporan.jsx style) */}
      <div className="p-1 rounded-xl flex gap-1 bg-gray-200/60 dark:bg-[#12192c]/80 mb-6">
        {["Hari Ini", "Mingguan", "Bulanan", "Semua"].map((f) => {
          const key = f.toLowerCase().replace(" ", "");
          const isSelected = filter === key;
          return (
            <button
              key={f}
              onClick={() => {
                setFilter(key);
              }}
              className={`flex-1 text-xs py-2 transition-all duration-200 ${
                isSelected
                  ? "font-extrabold rounded-lg shadow-sm bg-white dark:bg-[#1a2640] text-gray-900 dark:text-gray-100"
                  : "font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Ringkasan Keuangan RT */}
      <div
        className="relative overflow-hidden text-white p-5 rounded-2xl border border-transparent shadow-md mb-4"
        style={{
          background: "linear-gradient(145deg, #0a3460 0%, #0f4c81 50%, #1565a8 100%)",
        }}
      >
        {/* Background Icon (like home card carousel) */}
        <TrendingUp className="absolute -right-6 -bottom-6 w-44 h-44 text-white opacity-[0.07] pointer-events-none rotate-[-10deg]" />

        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider m-0">Total Saldo Tersedia</p>
            <p className="text-3xl font-extrabold text-white mt-2 mb-0 tracking-tight">{formatRupiah(globalTotalSaldo)}</p>
          </div>
          <span className="text-[10px] font-extrabold text-indigo-200 bg-white/10 border border-white/10 px-2.5 py-0.5 rounded-full capitalize shrink-0">
            {periodTitle}
          </span>
        </div>

        {/* Insight Saldo */}
        <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/60 uppercase">Status Arus Kas</span>
            {netChange > 0 ? (
              <span className="text-[11px] font-extrabold text-white bg-emerald-500/80 px-2.5 py-0.5 rounded-full shadow-sm">
                Surplus
              </span>
            ) : netChange < 0 ? (
              <span className="text-[11px] font-extrabold text-white bg-rose-500/80 px-2.5 py-0.5 rounded-full shadow-sm">
                Defisit
              </span>
            ) : (
              <span className="text-[11px] font-extrabold text-white bg-amber-500/80 px-2.5 py-0.5 rounded-full shadow-sm">
                Stabil
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-white/80 m-0 leading-relaxed">
            {netChange > 0 ? (
              <>
                Arus kas mengalami surplus sebesar{" "}
                <span className="font-extrabold text-emerald-300">{formatRupiah(netChange)}</span> pada periode ini.
              </>
            ) : netChange < 0 ? (
              <>
                Arus kas mengalami defisit sebesar{" "}
                <span className="font-extrabold text-rose-300">{formatRupiah(Math.abs(netChange))}</span> pada periode ini.
              </>
            ) : (
              <>Tidak ada penambahan atau pengurangan saldo yang tercatat pada periode ini.</>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Pemasukan Card */}
        <div className="bg-white dark:bg-[#1a2640] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                <ArrowDownLeft size={16} />
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase">Pemasukan</span>
            </div>
            <p className="text-base font-extrabold text-emerald-600 truncate m-0">{formatRupiah(totalMasuk)}</p>
          </div>
          <div className="mt-3 pt-2 border-t border-dashed border-gray-100 dark:border-slate-800/80 text-[10px] font-bold flex items-center gap-1">
            {masukChange > 0 ? (
              <span className="text-emerald-600">▲ {masukChange.toFixed(0)}%</span>
            ) : masukChange < 0 ? (
              <span className="text-rose-500">▼ {Math.abs(masukChange).toFixed(0)}%</span>
            ) : (
              <span className="text-gray-400">0%</span>
            )}
            <span className="text-gray-400 font-medium">vs {labelPeriodText}</span>
          </div>
        </div>

        {/* Pengeluaran Card */}
        <div className="bg-white dark:bg-[#1a2640] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
                <ArrowUpRight size={16} />
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase">Pengeluaran</span>
            </div>
            <p className="text-base font-extrabold text-rose-600 truncate m-0">{formatRupiah(totalKeluar)}</p>
          </div>
          <div className="mt-3 pt-2 border-t border-dashed border-gray-100 dark:border-slate-800/80 text-[10px] font-bold flex items-center gap-1">
            {keluarChange > 0 ? (
              <span className="text-rose-500">▲ {keluarChange.toFixed(0)}%</span>
            ) : keluarChange < 0 ? (
              <span className="text-emerald-600">▼ {Math.abs(keluarChange).toFixed(0)}%</span>
            ) : (
              <span className="text-gray-400">0%</span>
            )}
            <span className="text-gray-400 font-medium">vs {labelPeriodText}</span>
          </div>
        </div>
      </div>

      {/* Grafik Arus Kas */}
      <div className="bg-white dark:bg-[#1a2640] p-5 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4 gap-2">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-[15px] m-0 shrink-0">Grafik Arus Kas</h3>
          <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full capitalize truncate">
            {periodTitle}
          </span>
        </div>
        <div ref={chartScrollRef} className="w-full overflow-x-auto pb-2 scrollbar-none">
          <div 
            className="relative h-56"
            style={{ 
              width: barData?.labels?.length > 7 ? "200%" : "100%", 
              minWidth: "100%" 
            }}
          >
            {barData && <Bar data={barData} options={barOptions} />}
          </div>
        </div>
      </div>

      {/* Kategori Pengeluaran */}
      <div className="bg-white dark:bg-[#1a2640] p-5 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm mb-6">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-[15px] mb-4">Pengeluaran Per Kategori</h3>
        {pengeluaranPerPos.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-8">Belum ada pengeluaran pada periode ini</p>
        ) : (
          <div className="flex items-center gap-6">
            {/* Chart Container */}
            <div className="relative h-44 w-[45%] shrink-0">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>

            {/* Custom Legend Labels */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {pengeluaranPerPos.slice(0, 5).map(([kategori, nominal], index) => {
                const totalPeriod = pengeluaranPerPos.reduce((sum, [, val]) => sum + val, 0) || 1;
                const percentage = Math.round((nominal / totalPeriod) * 100);
                const colors = [
                  "#3b82f6",
                  "#10b981",
                  "#f59e0b",
                  "#8b5cf6",
                  "#ef4444",
                  "#14b8a6",
                  "#f97316",
                  "#94a3b8",
                ];
                const dotColor = colors[index % colors.length];

                return (
                  <div key={kategori} className="flex items-start gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="min-w-0 flex-1 leading-none">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate m-0">
                        {kategori}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5 m-0">
                        {percentage}% • {formatRupiah(nominal)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {pengeluaranPerPos.length > 5 && (
                <p className="text-[10px] text-gray-400 italic pl-5 m-0">
                  + {pengeluaranPerPos.length - 5} kategori lainnya
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Riwayat Transaksi Terakhir */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-[15px] m-0">Riwayat Transaksi Terakhir</h3>
        {transactions.length > 5 && (
          <button
            onClick={() => {
              setCurrentPage(1);
              setIsAllTrxOpen(true);
            }}
            className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 bg-transparent border-none cursor-pointer active:scale-95 transition-all"
          >
            Lihat Semua
            <ChevronRight size={13} />
          </button>
        )}
      </div>
      
      <div className="bg-white dark:bg-[#131c33] border border-gray-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        {loading && <div className="p-5 text-center text-xs text-gray-400">Memuat transaksi...</div>}
        {!loading && transactions.length === 0 && (
          <div className="p-5 text-center text-xs text-gray-400">Belum ada transaksi.</div>
        )}

        {!loading && transactions.length > 0 && (
          <div className="flex flex-col">
            {displayedTransactions.map((trx, index) => {
              const isPemasukan = trx.jenis === "pemasukan";
              const isVerified = String(trx.status).toLowerCase() === "verified";
              const trxUser = userMap[trx.id_user] || {};
              const userPhoto = trxUser.url_foto_profil;
              const userName = trxUser.nama || "Warga";
              
              return (
                <div
                  key={trx.id_transaksi || Math.random()}
                  className={`flex items-center justify-between gap-2.5 p-3.5 ${
                    index !== displayedTransactions.length - 1 ? "border-b border-gray-100/60 dark:border-slate-800/40" : ""
                  } transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/20`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* User Avatar with Cashflow Direction Indicator Badge */}
                    <div className="relative shrink-0 select-none">
                      {userPhoto ? (
                        <img
                          src={userPhoto}
                          alt={userName}
                          className="w-[36px] h-[36px] min-w-[36px] min-h-[36px] rounded-full object-cover border border-gray-100 dark:border-slate-700 shadow-sm"
                        />
                      ) : (
                        <div className="w-[36px] h-[36px] min-w-[36px] min-h-[36px] rounded-full border border-gray-100 dark:border-slate-700 shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-xs font-black tracking-widest overflow-hidden">
                          {getInitials(userName)}
                        </div>
                      )}
                      {/* Small overlay badge in bottom-right corner */}
                      <div 
                        className={`absolute bottom-[-2px] right-[-2px] w-[16px] h-[16px] min-w-[16px] min-h-[16px] rounded-full flex items-center justify-center border border-white dark:border-[#131c33] shadow-sm shrink-0 ${
                          isPemasukan 
                            ? "bg-green-500 text-white" 
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {isPemasukan ? (
                          <ArrowDownLeft size={9} className="stroke-[3]" />
                        ) : (
                          <ArrowUpRight size={9} className="stroke-[3]" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 m-0 truncate leading-snug">{trx.keterangan || "Tanpa Keterangan"}</p>
                        {!isVerified && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-500/20 uppercase tracking-wider leading-none">
                            Pending
                          </span>
                        )}
                      </div>
                      {/* Display user name who performed the transaction, along with the date */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold max-w-[80px] truncate leading-none">
                          {userName}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-655 font-bold leading-none select-none">
                          •
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap leading-none">
                          {safeDate(trx.timestamp).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p
                    className={`text-[13px] font-bold tabular-nums shrink-0 m-0 ${
                      isPemasukan ? "text-green-600 dark:text-green-400" : "text-rose-500 dark:text-rose-400"
                    }`}
                  >
                    {isPemasukan ? "+" : "-"} {formatRupiah(trx.nominal)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />

      {/* All Cashflow Transactions Bottom Sheet with Pagination */}
      <AllCashflowTransactionsSheet
        transactions={transactions}
        isOpen={isAllTrxOpen}
        onClose={() => setIsAllTrxOpen(false)}
        formatRupiah={formatRupiah}
        userMap={userMap}
        getInitials={getInitials}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />

      {/* Report Preview Modal */}
      <ReportPreviewModal
        isOpen={isReportPreviewOpen}
        onClose={() => setIsReportPreviewOpen(false)}
        periodTitle={periodTitle}
        beginningBalance={beginningBalance}
        totalMasuk={totalMasuk}
        totalKeluar={totalKeluar}
        netChange={netChange}
        chronologicalLedger={chronologicalLedger}
        pengeluaranPerPos={pengeluaranPerPos}
        formatRupiah={formatRupiah}
        userMap={userMap}
      />
    </div>
  );
}

// ── All Cashflow Transactions Bottom Sheet with Pagination ──────────────────
function AllCashflowTransactionsSheet({
  transactions,
  isOpen,
  onClose,
  formatRupiah,
  userMap,
  getInitials,
  currentPage,
  setCurrentPage
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reset page when sheet closes or opens
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(1);
    }
  }, [isOpen]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTransactions = transactions.slice(startIndex, endIndex);

  return (
    <div
      className={`fixed inset-0 z-[200] flex justify-center items-end transition-all duration-300 ${
        isOpen ? "bg-black/50 pointer-events-auto" : "bg-transparent pointer-events-none"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-[24px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          maxHeight: "85dvh",
          height: "85dvh",
          transform: isOpen ? "translateY(0)" : "translateY(calc(100% + 80px))",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-0 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800/80 shrink-0">
          <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100 m-0">Semua Riwayat Transaksi</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800/60 flex items-center justify-center border-none cursor-pointer text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700/65 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto px-0 py-0 flex flex-col flex-1">
          {paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((trx, index) => {
              const isPemasukan = trx.jenis === "pemasukan";
              const isVerified = String(trx.status).toLowerCase() === "verified";
              const trxUser = userMap[trx.id_user] || {};
              const userPhoto = trxUser.url_foto_profil;
              const userName = trxUser.nama || "Warga";

              return (
                <div
                  key={trx.id_transaksi || Math.random()}
                  className={`flex items-center justify-between gap-2.5 p-3.5 ${
                    index !== paginatedTransactions.length - 1 ? "border-b border-gray-100/60 dark:border-slate-800/40" : ""
                  } transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/20`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* User Avatar with Cashflow Direction Indicator Badge */}
                    <div className="relative shrink-0 select-none">
                      {userPhoto ? (
                        <img
                          src={userPhoto}
                          alt={userName}
                          className="w-[36px] h-[36px] min-w-[36px] min-h-[36px] rounded-full object-cover border border-gray-100 dark:border-slate-700 shadow-sm"
                        />
                      ) : (
                        <div className="w-[36px] h-[36px] min-w-[36px] min-h-[36px] rounded-full border border-gray-100 dark:border-slate-700 shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-xs font-black tracking-widest overflow-hidden">
                          {getInitials(userName)}
                        </div>
                      )}
                      {/* Small overlay badge in bottom-right corner */}
                      <div
                        className={`absolute bottom-[-2px] right-[-2px] w-[16px] h-[16px] min-w-[16px] min-h-[16px] rounded-full flex items-center justify-center border border-white dark:border-[#131c33] shadow-sm shrink-0 ${
                          isPemasukan
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {isPemasukan ? (
                          <ArrowDownLeft size={9} className="stroke-[3]" />
                        ) : (
                          <ArrowUpRight size={9} className="stroke-[3]" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 m-0 truncate leading-snug">{trx.keterangan || "Tanpa Keterangan"}</p>
                        {!isVerified && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-500/20 uppercase tracking-wider leading-none">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold max-w-[80px] truncate leading-none">
                          {userName}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-655 font-bold leading-none select-none">
                          •
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap leading-none">
                          {safeDate(trx.timestamp).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p
                    className={`text-[13px] font-bold tabular-nums shrink-0 m-0 ${
                      isPemasukan ? "text-green-600 dark:text-green-400" : "text-rose-500 dark:text-rose-400"
                    }`}
                  >
                    {isPemasukan ? "+" : "-"} {formatRupiah(trx.nominal)}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="py-12 px-6 text-center">
              <p className="text-sm font-normal text-gray-500 m-0">
                Belum ada riwayat transaksi pada bulan ini.
              </p>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50 dark:bg-slate-900/40 shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer"
            >
              <ChevronLeft size={16} />
              Sebelumnya
            </button>
            <span className="text-[11px] font-extrabold text-gray-500 dark:text-gray-400">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer"
            >
              Berikutnya
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Report Preview & Export Modal ──────────────────────────────────────────
function ReportPreviewModal({
  isOpen,
  onClose,
  periodTitle,
  beginningBalance,
  totalMasuk,
  totalKeluar,
  netChange,
  chronologicalLedger,
  pengeluaranPerPos,
  formatRupiah,
  userMap,
}) {
  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent = [];
    csvContent.push(`"LAPORAN ARUS KAS WARGA (CASH FLOW STATEMENT)"`);
    csvContent.push(`"Perumahan Teras Bali Ungaran (TBU)"`);
    csvContent.push(`"Periode Laporan: ${periodTitle}"`);
    csvContent.push(`"Tanggal Unduh: ${new Date().toLocaleDateString("id-ID")}"`);
    csvContent.push(""); // empty row

    // Summary block
    csvContent.push(`"Ringkasan Keuangan"`);
    csvContent.push(`"Saldo Awal","${beginningBalance}"`);
    csvContent.push(`"Total Pemasukan","${totalMasuk}"`);
    csvContent.push(`"Total Pengeluaran","${totalKeluar}"`);
    csvContent.push(`"Saldo Akhir","${beginningBalance + totalMasuk - totalKeluar}"`);
    csvContent.push(`"Surplus/Defisit","${netChange}"`);
    csvContent.push(""); // empty row

    // General Ledger
    csvContent.push(`"Buku Kas Rinci (General Ledger)"`);
    csvContent.push(`"No","Tanggal","Keterangan","Kategori","Oleh","Debit (Masuk)","Kredit (Keluar)","Saldo Berjalan"`);

    chronologicalLedger.forEach((trx, idx) => {
      const isMasuk = trx.jenis === "pemasukan";
      const nominal = Number(trx.nominal) || 0;
      const debit = isMasuk ? nominal : 0;
      const kredit = !isMasuk ? nominal : 0;
      const trxUser = userMap[trx.id_user] || {};
      const userName = trxUser.nama || "Warga";
      
      const dateStr = safeDate(trx.timestamp).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });

      csvContent.push(`"${idx + 1}","${dateStr}","${(trx.keterangan || "").replace(/"/g, '""')}","${(trx.kategori || "Lainnya").replace(/"/g, '""')}","${userName.replace(/"/g, '""')}","${debit}","${kredit}","${trx.runningBalance}"`);
    });

    // Expenses per Category
    csvContent.push("");
    csvContent.push(`"Rekapitulasi Pengeluaran Per Kategori"`);
    csvContent.push(`"No","Kategori Pengeluaran","Total Nominal"`);
    pengeluaranPerPos.forEach(([kategori, nominal], idx) => {
      csvContent.push(`"${idx + 1}","${kategori.replace(/"/g, '""')}","${nominal}"`);
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9]/g, "_");
    link.setAttribute("download", `Laporan_Keuangan_TBU_${cleanPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[220] overflow-y-auto bg-slate-900/70 dark:bg-black/80 backdrop-blur-[2px] p-0 md:p-6 flex justify-center items-start print:static print:bg-white print:p-0 print:overflow-visible"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[840px] bg-slate-100 dark:bg-[#131c33] rounded-t-[24px] md:rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-slate-800/80 animate-[scaleUp_0.25s_ease-out] print:rounded-none print:shadow-none print:border-none print:bg-white print:text-black print:w-full print:static"
        role="dialog"
        aria-modal="true"
      >
        {/* Header / Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#1a2640] border-b border-gray-200 dark:border-slate-800/80 shrink-0 print:hidden">
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 m-0">Pratinjau Laporan Keuangan</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 m-0 mt-0.5">Format akuntansi standar ekspor & cetak</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-none rounded-xl p-[8px_14px] text-[12px] font-bold cursor-pointer transition-all active:scale-[0.97]"
            >
              <Printer size={14} />
              Cetak / PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl p-[8px_14px] text-[12px] font-bold cursor-pointer transition-all active:scale-[0.97]"
            >
              <Download size={14} />
              CSV / Excel
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800/60 flex items-center justify-center border-none cursor-pointer text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700/65 transition-colors shrink-0"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* virtual printable area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100 dark:bg-[#0b1020] print:p-0 print:bg-white print:overflow-visible">
          
          {/* Virtual Paper Sheet */}
          <div className="bg-white text-slate-900 p-8 md:p-12 shadow-sm border border-gray-200/60 mx-auto w-full min-h-[842px] relative flex flex-col justify-between print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
            
            <div className="flex flex-col gap-6 w-full">
              {/* Kop Laporan / Letterhead */}
              <div className="text-center pb-4 border-b-2 border-slate-900 flex flex-col items-center">
                <span className="text-[17px] font-black tracking-widest text-slate-900 leading-none">LAPORAN ARUS KAS KEUANGAN WARGA</span>
                <span className="text-[12px] font-extrabold tracking-wider text-slate-600 mt-1.5 uppercase">PERUMAHAN TERAS BALI UNGARAN (TBU)</span>
                <span className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-wide bg-slate-100 px-3 py-1 rounded-md print:bg-transparent print:p-0">
                  PERIODE: {periodTitle}
                </span>
                <div className="text-[8px] font-mono text-slate-400 mt-2.5 print:text-slate-500">
                  Dicetak secara otomatis pada: {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                </div>
              </div>

              {/* Ringkasan Saldo (Executive Summary) */}
              <div className="mt-2">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-4 border-blue-600 pl-2 print:border-slate-800">
                  I. Ringkasan Eksekutif
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print:bg-transparent print:rounded-none">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Saldo Awal</span>
                    <span className="text-[13px] font-extrabold text-slate-800 mt-1 block">{formatRupiah(beginningBalance)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print:bg-transparent print:rounded-none">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Total Pemasukan</span>
                    <span className="text-[13px] font-extrabold text-emerald-600 mt-1 block">+{formatRupiah(totalMasuk)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print:bg-transparent print:rounded-none">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Total Pengeluaran</span>
                    <span className="text-[13px] font-extrabold text-rose-500 mt-1 block">-{formatRupiah(totalKeluar)}</span>
                  </div>
                </div>
                
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between print:bg-transparent print:rounded-none">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Saldo Akhir Tersedia</span>
                    <span className="text-[15px] font-black text-slate-900 block mt-0.5">{formatRupiah(beginningBalance + totalMasuk - totalKeluar)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Surplus / Defisit</span>
                    <span className={`text-[12px] font-black block mt-0.5 ${netChange >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {netChange >= 0 ? "Surplus " : "Defisit "} {formatRupiah(Math.abs(netChange))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Buku Kas Rinci (Ledger Table) */}
              <div className="mt-2">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-4 border-blue-600 pl-2 print:border-slate-800">
                  II. Buku Kas Rinci (General Ledger)
                </h4>
                <div className="w-full overflow-x-auto print:overflow-visible">
                  <table className="w-full border-collapse text-[10px] text-slate-700">
                    <thead>
                      <tr className="bg-slate-100 border-t border-b border-slate-300 print:bg-transparent print:border-t-2 print:border-b-2 print:border-slate-900">
                        <th className="p-2 text-left font-bold w-[4%]">No</th>
                        <th className="p-2 text-left font-bold w-[12%]">Tanggal</th>
                        <th className="p-2 text-left font-bold w-[28%]">Keterangan</th>
                        <th className="p-2 text-left font-bold w-[16%]">Kategori</th>
                        <th className="p-2 text-left font-bold w-[12%]">Oleh</th>
                        <th className="p-2 text-right font-bold w-[13%]">Debit</th>
                        <th className="p-2 text-right font-bold w-[13%]">Kredit</th>
                        <th className="p-2 text-right font-bold w-[14%]">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Saldo Awal Row */}
                      <tr className="border-b border-slate-150">
                        <td className="p-2 text-left font-semibold" colSpan={5}>
                          SALDO AWAL PERIODE
                        </td>
                        <td className="p-2 text-right">-</td>
                        <td className="p-2 text-right">-</td>
                        <td className="p-2 text-right font-black tabular-nums">
                          {formatRupiah(beginningBalance)}
                        </td>
                      </tr>

                      {/* Transaction Rows */}
                      {chronologicalLedger.length > 0 ? (
                        chronologicalLedger.map((trx, index) => {
                          const isMasuk = trx.jenis === "pemasukan";
                          const trxUser = userMap[trx.id_user] || {};
                          const userName = trxUser.nama || "Warga";
                          return (
                            <tr key={trx.id_transaksi || index} className="border-b border-slate-100 hover:bg-slate-50/50 print:hover:bg-transparent">
                              <td className="p-2 text-left text-slate-500 tabular-nums">{index + 1}</td>
                              <td className="p-2 text-left tabular-nums">
                                {safeDate(trx.timestamp).toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric"
                                })}
                              </td>
                              <td className="p-2 text-left font-bold text-slate-800 truncate max-w-[140px] print:max-w-none print:whitespace-normal">
                                {trx.keterangan || "Tanpa Keterangan"}
                              </td>
                              <td className="p-2 text-left text-slate-500">{trx.kategori || "Lainnya"}</td>
                              <td className="p-2 text-left text-slate-500 truncate max-w-[70px]">{userName}</td>
                              <td className="p-2 text-right text-emerald-600 font-bold tabular-nums">
                                {isMasuk ? `+${formatRupiah(trx.nominal)}` : "-"}
                              </td>
                              <td className="p-2 text-right text-rose-500 font-bold tabular-nums">
                                {!isMasuk ? `-${formatRupiah(trx.nominal)}` : "-"}
                              </td>
                              <td className="p-2 text-right font-bold text-slate-800 tabular-nums">
                                {formatRupiah(trx.runningBalance)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                            Tidak ada transaksi mutasi kas dalam periode ini
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rekapitulasi Pengeluaran Per Pos */}
              {pengeluaranPerPos.length > 0 && (
                <div className="mt-2 page-break-avoid">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-4 border-blue-600 pl-2 print:border-slate-800">
                    III. Rekapitulasi Pengeluaran Per Kategori (Pos Pengeluaran)
                  </h4>
                  <div className="w-[60%] print:w-[80%]">
                    <table className="w-full border-collapse text-[10px] text-slate-700">
                      <thead>
                        <tr className="bg-slate-100 border-t border-b border-slate-300 print:bg-transparent print:border-t-2 print:border-b-2 print:border-slate-900">
                          <th className="p-2 text-left font-bold w-[10%]">No</th>
                          <th className="p-2 text-left font-bold w-[60%]">Kategori Pengeluaran</th>
                          <th className="p-2 text-right font-bold w-[30%]">Total Nominal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pengeluaranPerPos.map(([kategori, nominal], index) => (
                          <tr key={kategori} className="border-b border-slate-100">
                            <td className="p-2 text-left text-slate-500 tabular-nums">{index + 1}</td>
                            <td className="p-2 text-left font-bold text-slate-800">{kategori}</td>
                            <td className="p-2 text-right text-rose-600 font-extrabold tabular-nums">
                              {formatRupiah(nominal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Validation / Sign-off Block */}
            <div className="mt-12 pt-6 border-t border-dashed border-slate-200 grid grid-cols-2 gap-8 text-[10px] text-slate-800 page-break-avoid print:mt-16 print:border-slate-400">
              <div className="flex flex-col items-center text-center">
                <span className="text-slate-400 uppercase tracking-wider text-[8px] font-extrabold">Disusun Oleh,</span>
                <span className="font-extrabold text-slate-800 mt-1 uppercase">Bendahara TBU</span>
                <div className="h-16 w-32 flex items-end justify-center border-b border-slate-300 text-[8px] text-slate-400 italic pb-1">
                  ( Tanda Tangan & Tanggal )
                </div>
                <span className="mt-2 text-slate-500">Petugas Keuangan Lingkungan</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-slate-400 uppercase tracking-wider text-[8px] font-extrabold">Mengetahui & Menyetujui,</span>
                <span className="font-extrabold text-slate-800 mt-1 uppercase">Ketua RT / RW TBU</span>
                <div className="h-16 w-32 flex items-end justify-center border-b border-slate-300 text-[8px] text-slate-400 italic pb-1">
                  ( Tanda Tangan & Tanggal )
                </div>
                <span className="mt-2 text-slate-500">Perwakilan Warga Hunian</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
