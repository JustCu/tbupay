import { useState, useEffect, useMemo, useRef } from "react";
import useStore from "../store/useStore";
import { TrendingUp, ArrowDownLeft, ArrowUpRight, Bell } from "lucide-react";
import { getTransactions } from "../application/use-cases/transactions/transactionUseCases";
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
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const chartScrollRef = useRef(null);

  const fetchTransactions = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else {
      setLoading((prev) => (transactions.length > 0 ? false : true));
    }

    try {
      const res = await getTransactions(
        forceRefresh ? { forceRefresh: true } : {},
      );
      if (res?._meta?.source) {
        setDataSource(res._meta.source);
      }
      if (res.status === "success" && Array.isArray(res.data)) {
        const sortedData = [...res.data].sort(
          (a, b) => safeDate(b.timestamp) - safeDate(a.timestamp),
        );
        setTransactions(sortedData);
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

  const displayedTransactions = showAllTransactions
    ? transactions
    : transactions.slice(0, 5);

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
        <div
          className="cursor-pointer relative transition-all duration-200 flex items-center justify-center p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full active:scale-95 shrink-0 mt-1"
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
                setShowAllTransactions(false);
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
      <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-[15px]">Riwayat Transaksi Terakhir</h3>
      <div className="flex flex-col gap-3">
        {loading && <div className="p-4 text-center text-xs text-gray-400">Memuat transaksi...</div>}
        {!loading && transactions.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400">Belum ada transaksi.</div>
        )}

        {!loading &&
          displayedTransactions.map((trx) => {
            const isPemasukan = trx.jenis === "pemasukan";
            const isVerified = String(trx.status).toLowerCase() === "verified";
            return (
              <div
                key={trx.id_transaksi || Math.random()}
                className="bg-white dark:bg-[#1a2640] p-4 rounded-xl flex items-center justify-between border border-gray-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isPemasukan 
                        ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400" 
                        : "bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400"
                    }`}
                  >
                    {isPemasukan ? (
                      <ArrowDownLeft size={20} />
                    ) : (
                      <ArrowUpRight size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 m-0 truncate">{trx.keterangan || "Tanpa Keterangan"}</p>
                      {!isVerified && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide">
                          Pending
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                      {safeDate(trx.timestamp).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-[14px] font-bold tabular-nums shrink-0 m-0 ${
                    isPemasukan ? "text-green-600 dark:text-green-400" : "text-rose-500 dark:text-rose-400"
                  }`}
                >
                  {isPemasukan ? "+" : "-"} {formatRupiah(trx.nominal)}
                </p>
              </div>
            );
          })}

        {!loading && transactions.length > 5 && (
          <button
            onClick={() => setShowAllTransactions(!showAllTransactions)}
            className="mt-2 w-full py-3 bg-gray-50 dark:bg-[#1a2640]/50 border border-gray-100 dark:border-slate-800/80 text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-all flex items-center justify-center gap-1 active:scale-95"
          >
            {showAllTransactions ? "Sembunyikan" : "Lihat Semua"}
          </button>
        )}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </div>
  );
}
