import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  RefreshCw,
  ShieldCheck,
  X,
  ArrowLeft,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../application/use-cases/users/userUseCases";
import useStore from "../store/useStore";
import CacheFallbackBadge from "../components/CacheFallbackBadge";
import usePullToRefresh from "../hooks/usePullToRefresh";

const EMPTY_FORM = {
  nama: "",
  blok_rumah: "",
  no_hp: "",
  role: "warga",
  status_warga: "tetap",
  password: "",
};

/** Helper to get initials from name */
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function AdminUserManagement() {
  const currentUser = useStore((s) => s.user);
  const showAlert = useStore((s) => s.showAlert);
  const showConfirm = useStore((s) => s.showConfirm);
  const [users, setUsers] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getUsers:{}");
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

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getUsers:{}");
      if (cached) return false;
    } catch (e) {
      console.error(e);
    }
    return true;
  });

  const [refreshing, setRefreshing] = useState(false);

  const [dataSource, setDataSource] = useState(() => {
    try {
      const cached = localStorage.getItem("tbu_pay_cache_v1:getUsers:{}");
      if (cached) return "cache";
    } catch (e) {
      console.error(e);
    }
    return "network";
  });

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'tile'
  const [selectedUser, setSelectedUser] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchUsers = useCallback(
    async (showRefresh = false, forceRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else {
        setLoading(() => {
          try {
            const cached = localStorage.getItem("tbu_pay_cache_v1:getUsers:{}");
            if (cached) return false;
          } catch {}
          return true;
        });
      }
      try {
        const res = await getUsers(forceRefresh ? { forceRefresh: true } : {});
        if (res?._meta?.source) {
          setDataSource(res._meta.source);
        }
        if (res.status === "success") {
          setUsers(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const pull = usePullToRefresh({
    onRefresh: () => fetchUsers(true, true),
    disabled: loading || refreshing || saving,
  });

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEdit = (user) => {
    setEditTarget(user);
    setForm({
      nama: user.nama,
      blok_rumah: user.blok_rumah,
      no_hp: user.no_hp || "",
      role: user.role,
      status_warga: user.status_warga || "tetap",
      password: "", // blank means keep existing
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditTarget(null);
  };

  const handleDelete = async (user) => {
    showConfirm(
      `Hapus user "${user.nama}" (${user.blok_rumah})? Tindakan ini tidak dapat dibatalkan.`,
      async () => {
        try {
          const res = await deleteUser(user.id_user);
          if (res.status === "success") {
            setUsers((prev) => prev.filter((u) => u.id_user !== user.id_user));
          } else {
            showAlert("Gagal: " + res.message, {
              variant: "danger",
              title: "Gagal",
            });
          }
        } catch (e) {
          showAlert("Terjadi kesalahan koneksi.", {
            variant: "danger",
            title: "Kesalahan Koneksi",
          });
        }
      },
      { title: "Hapus User", variant: "danger", confirmLabel: "Hapus" },
    );
  };

  const handleSave = async () => {
    setFormError("");
    if (currentUser?.role !== "admin") {
      if (!editTarget || editTarget.id_user !== currentUser?.id_user) {
        setFormError("Akses ditolak: Anda hanya dapat mengubah akun Anda sendiri.");
        return;
      }
      if (form.role !== editTarget?.role) {
        setFormError("Akses ditolak: Anda tidak dapat mengubah role Anda sendiri.");
        return;
      }
    }
    if (!form.nama.trim() || !form.blok_rumah.trim()) {
      setFormError("Nama dan Blok/Username wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editTarget) {
        res = await updateUser({ ...form, id_user: editTarget.id_user });
      } else {
        res = await createUser(form);
      }

      if (res.status === "success") {
        closeForm();
        fetchUsers(true, true);
      } else {
        setFormError(res.message || "Terjadi kesalahan.");
      }
    } catch (e) {
      setFormError("Terjadi kesalahan koneksi.");
    } finally {
      setSaving(false);
    }
  };



  const filtered = users.filter(
    (u) =>
      u.nama?.toLowerCase().includes(search.toLowerCase()) ||
      u.blok_rumah?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase()),
  );

  const counts = {
    warga: users.filter((u) => u.role === "warga").length,
    admin: users.filter((u) => u.role === "admin").length,
    petugas: users.filter((u) => u.role === "petugas").length,
  };

  return (
    <div className="pb-[100px] animate-[fadeIn_0.3s_ease-in-out]" {...pull.bind}>
      {pull.showPullHint && (
        <div className={`sticky top-2 z-[31] mx-auto mb-2.5 w-fit px-3 py-[7px] rounded-full border text-xs font-semibold ${pull.isReady ? "border-green-300 bg-green-50 text-green-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}>
          {pull.isReady ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang"}
        </div>
      )}
      <CacheFallbackBadge source={dataSource} />
      {/* Header */}
      <div className="py-4 pb-3 flex justify-between items-center">
        <div>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 m-0">Manajemen Warga</h2>
          <p className="text-[12px] text-gray-400 mt-[2px] m-0">
            {users.length} warga terdaftar
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`flex items-center gap-1.5 rounded-[10px] p-[8px_14px] text-[13px] font-bold cursor-pointer transition-opacity bg-gray-100 text-gray-500 border-none hover:opacity-90`}
            onClick={() => fetchUsers(true, true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          {currentUser?.role === "admin" && (
            <button className="flex items-center gap-1.5 bg-[#0f4c81] text-white border-none rounded-[10px] p-[8px_14px] text-[13px] font-bold cursor-pointer transition-opacity hover:opacity-90" onClick={openAdd}>
              <Plus size={16} />
              Tambah
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="bg-white rounded-[14px] p-[14px_10px] text-center border border-gray-100">
          <div className="text-[22px] font-extrabold text-blue-600">{counts.warga}</div>
          <div className="text-[10px] text-gray-400 mt-[2px] uppercase font-semibold">Warga</div>
        </div>
        <div className="bg-white rounded-[14px] p-[14px_10px] text-center border border-gray-100">
          <div className="text-[22px] font-extrabold text-purple-600">{counts.admin}</div>
          <div className="text-[10px] text-gray-400 mt-[2px] uppercase font-semibold">Admin</div>
        </div>
        <div className="bg-white rounded-[14px] p-[14px_10px] text-center border border-gray-100">
          <div className="text-[22px] font-extrabold text-cyan-600">{counts.petugas}</div>
          <div className="text-[10px] text-gray-400 mt-[2px] uppercase font-semibold">Petugas</div>
        </div>
      </div>

      {/* Search and Layout Toggle */}
      <div className="flex gap-2.5 mb-4 items-center shrink-0">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, blok, atau role..."
            className="w-full p-[10px_12px_10px_38px] border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1a2640] text-gray-850 dark:text-gray-100 text-[13px] rounded-xl outline-none font-sans focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Layout Segment Toggle */}
        <div className="flex bg-gray-105 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 border border-gray-200/50 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-lg border-none cursor-pointer transition-all flex items-center justify-center ${
              viewMode === "list"
                ? "bg-white dark:bg-[#131c33] text-blue-600 dark:text-blue-400 shadow-sm"
                : "bg-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600"
            }`}
            title="Tampilan Daftar (List)"
          >
            <LayoutList size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tile")}
            className={`p-1.5 rounded-lg border-none cursor-pointer transition-all flex items-center justify-center ${
              viewMode === "tile"
                ? "bg-white dark:bg-[#131c33] text-blue-600 dark:text-blue-400 shadow-sm"
                : "bg-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600"
            }`}
            title="Tampilan Kotak (Tile)"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* User List */}
      {loading ? (
        <div className="text-center py-12 px-4 text-gray-400 flex flex-col items-center gap-2 text-[13px]">
          <RefreshCw
            size={28}
            className="animate-spin"
          />
          <span>Memuat data warga...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4 text-gray-400 flex flex-col items-center gap-2 text-[13px]">
          <Users size={40} color="#d1d5db" />
          <p className="font-semibold text-gray-700 text-[14px] m-0">Tidak ada warga</p>
          <span>
            {search
              ? "Coba kata kunci lain."
              : "Belum ada warga yang terdaftar."}
          </span>
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-2.5">
          {filtered.map((user) => (
            <div
              key={user.id_user}
              onClick={() => setSelectedUser(user)}
              className="bg-white dark:bg-[#1a2640] rounded-2xl border border-gray-50 dark:border-slate-800/60 p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 active:scale-[0.99]"
            >
              {/* Profile Avatar / Initials */}
              {user.url_foto_profil ? (
                <img
                  src={user.url_foto_profil}
                  alt={user.nama}
                  className="w-11 h-11 rounded-full object-cover border border-gray-100 dark:border-slate-700 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full border border-gray-100 dark:border-slate-700/80 shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-[15px] font-black tracking-widest overflow-hidden shrink-0">
                  {getInitials(user.nama)}
                </div>
              )}

              {/* Citizen Details */}
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-gray-800 dark:text-gray-100 truncate leading-tight">{user.nama}</div>
                <div className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap leading-none">
                  <span className="font-bold text-gray-500 dark:text-slate-300 bg-gray-100 dark:bg-slate-850/80 p-[2.5px_6px] rounded-md text-[10px]">{user.blok_rumah}</span>
                  {user.no_hp && <span className="text-[10px] text-gray-400">{user.no_hp}</span>}
                </div>
                <div className="flex gap-1.5 mt-2.5 items-center flex-wrap">
                  {/* Role Badge */}
                  <span className={`text-[9.5px] font-extrabold p-[2px_8px] rounded-full uppercase border ${
                    user.role === 'warga' ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/20' :
                    user.role === 'admin' ? 'bg-purple-50/50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-100/50 dark:border-purple-900/20' :
                    'bg-cyan-50/50 dark:bg-cyan-900/10 text-cyan-600 dark:text-cyan-400 border-cyan-100/50 dark:border-cyan-900/20'
                  }`}>
                    {user.role}
                  </span>
                  {/* Status Badge */}
                  {user.status_warga && (
                    <span className={`text-[9.5px] font-extrabold p-[2px_8px] rounded-full uppercase border ${
                      user.status_warga === 'tetap' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/20' :
                      user.status_warga === 'kontrak' ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/20' :
                      user.status_warga === 'kos' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/20' :
                      'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-900/20'
                    }`}>
                      {user.status_warga}
                    </span>
                  )}
                </div>
              </div>

              {/* Minimalist Action Buttons */}
              <div className="flex gap-2 shrink-0">
                {(currentUser?.role === "admin" || user.id_user === currentUser?.id_user) && (
                  <button
                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800/40 text-gray-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20 dark:hover:text-blue-400 border border-gray-150/40 dark:border-slate-800/50 flex items-center justify-center transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(user);
                    }}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {currentUser?.role === "admin" && (
                  <button
                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800/40 text-gray-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 border border-gray-150/40 dark:border-slate-800/50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(user);
                    }}
                    title="Hapus"
                    disabled={user.id_user === currentUser?.id_user}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tile / Grid View Mode */
        <div className="grid grid-cols-2 gap-3.5">
          {filtered.map((user) => (
            <div
              key={user.id_user}
              onClick={() => setSelectedUser(user)}
              className="bg-white dark:bg-[#1a2640] rounded-2xl border border-gray-50 dark:border-slate-800/60 p-4 flex flex-col items-center text-center relative shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 active:scale-[0.99] group overflow-hidden"
            >
              {/* Mini Action Buttons on top right corner */}
              <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                {(currentUser?.role === "admin" || user.id_user === currentUser?.id_user) && (
                  <button
                    className="w-7 h-7 rounded-full bg-white/90 dark:bg-slate-800/90 text-gray-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 border border-gray-150/40 dark:border-slate-700/50 flex items-center justify-center transition-colors shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(user);
                    }}
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {currentUser?.role === "admin" && (
                  <button
                    className="w-7 h-7 rounded-full bg-white/90 dark:bg-slate-800/90 text-gray-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 border border-gray-150/40 dark:border-slate-700/50 flex items-center justify-center transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(user);
                    }}
                    title="Hapus"
                    disabled={user.id_user === currentUser?.id_user}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Profile Avatar / Initials */}
              <div className="mb-3 mt-1.5">
                {user.url_foto_profil ? (
                  <img
                    src={user.url_foto_profil}
                    alt={user.nama}
                    className="w-[60px] h-[60px] rounded-full object-cover border border-gray-100 dark:border-slate-700 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-[60px] h-[60px] rounded-full border border-gray-100 dark:border-slate-700/80 shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-[18px] font-black tracking-widest overflow-hidden shrink-0">
                    {getInitials(user.nama)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="w-full flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 truncate leading-snug w-full px-1">{user.nama}</div>
                  <div className="mt-1 flex items-center justify-center">
                    <span className="font-bold text-gray-500 dark:text-slate-350 bg-gray-100/80 dark:bg-slate-800/80 p-[2px_6px] rounded text-[9.5px] tracking-wide">{user.blok_rumah}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-3 items-center w-full">
                  <div className="flex gap-1 justify-center items-center flex-wrap">
                    {/* Role Badge */}
                    <span className={`text-[8.5px] font-extrabold p-[1.5px_6px] rounded-full uppercase border ${
                      user.role === 'warga' ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/20' :
                      user.role === 'admin' ? 'bg-purple-50/50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-100/50 dark:border-purple-900/20' :
                      'bg-cyan-50/50 dark:bg-cyan-900/10 text-cyan-600 dark:text-cyan-400 border-cyan-100/50 dark:border-cyan-900/20'
                    }`}>
                      {user.role}
                    </span>
                    {/* Status Badge */}
                    {user.status_warga && (
                      <span className={`text-[8.5px] font-extrabold p-[1.5px_6px] rounded-full uppercase border ${
                        user.status_warga === 'tetap' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/20' :
                        user.status_warga === 'kontrak' ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/20' :
                        user.status_warga === 'kos' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/20' :
                        'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-900/20'
                      }`}>
                        {user.status_warga}
                      </span>
                    )}
                  </div>
                  {user.no_hp && (
                    <span className="text-[10px] text-gray-400 dark:text-slate-400 mt-1 block max-w-full truncate">{user.no_hp}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Full-Screen Modal */}
      <div
        className={`fixed inset-0 z-[70] w-full bg-white dark:bg-[#131c33] max-w-[480px] left-1/2 -translate-x-1/2 flex flex-col overflow-hidden transition-all duration-300 ${
          isFormOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#131c33] border-b border-slate-100 dark:border-slate-800/80 shrink-0 shadow-sm pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
          <button
            type="button"
            className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-full text-slate-600 dark:text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-700/60 active:scale-95 shrink-0"
            onClick={closeForm}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 m-0 leading-tight">
              {editTarget ? "Edit Warga" : "Tambah Warga Baru"}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 m-0 mt-0.5 leading-normal">
              {editTarget ? "Perbarui informasi hunian & akun warga" : "Daftarkan warga baru ke sistem hunian"}
            </p>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 bg-gray-50 dark:bg-[#0b1020]">
          {formError && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3.5 rounded-2xl text-[13px] font-semibold border border-red-100 dark:border-red-500/20 leading-relaxed shadow-sm">
              <span>⚠️ {formError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
            <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Nama Lengkap</label>
            <input
              className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
              type="text"
              placeholder="Contoh: Pak Budi Santoso"
              value={form.nama}
              onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Blok / Username</label>
              <input
                className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
                type="text"
                placeholder="A-12"
                value={form.blok_rumah}
                onChange={(e) =>
                  setForm((p) => ({ ...p, blok_rumah: e.target.value }))
                }
              />
              <span className="text-[9px] text-gray-400 dark:text-slate-500 mt-[2px] leading-tight">
                Digunakan sebagai username login
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">No. HP</label>
              <input
                className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={form.no_hp}
                onChange={(e) =>
                  setForm((p) => ({ ...p, no_hp: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
             <div className="flex flex-col gap-1.5">
               <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Role</label>
               <select
                 className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500 disabled:opacity-60"
                 value={form.role}
                 onChange={(e) =>
                   setForm((p) => ({ ...p, role: e.target.value }))
                 }
                 disabled={currentUser?.role !== "admin"}
               >
                 <option value="warga">Warga</option>
                 <option value="petugas">Petugas</option>
                 <option value="admin">Admin</option>
               </select>
             </div>
             <div className="flex flex-col gap-1.5">
               <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Status Warga</label>
               <select
                 className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
                 value={form.status_warga}
                 onChange={(e) =>
                   setForm((p) => ({ ...p, status_warga: e.target.value }))
                 }
               >
                 <option value="tetap">Tetap</option>
                 <option value="kontrak">Kontrak</option>
                 <option value="kos">Kos</option>
                 <option value="sementara">Sementara</option>
               </select>
             </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-white dark:bg-[#131c33] p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-xs">
            <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-550 uppercase tracking-wider">Password</label>
            <input
              className="w-full min-h-[44px] py-2.5 px-4 bg-gray-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-[#2c3c5e]/80 rounded-2xl font-sans text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:bg-white dark:focus:bg-[#131c33] focus:border-blue-500 dark:focus:border-indigo-500"
              type="password"
              placeholder={
                editTarget ? "(biarkan kosong jika tidak diubah)" : "Default: 123456"
              }
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <button 
              type="button"
              className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#131c33] text-[14px] font-bold text-gray-500 dark:text-gray-400 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-[0.98]" 
              onClick={closeForm}
            >
              Batal
            </button>
            <button 
              type="button"
              className="p-3.5 rounded-2xl border-none bg-[#0f4c81] text-white text-[14px] font-bold cursor-pointer transition-all hover:bg-[#0a3460] disabled:opacity-60 disabled:cursor-not-allowed shadow-md active:scale-[0.98]" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving
                ? "Menyimpan..."
                : editTarget
                  ? "Simpan"
                  : "Tambah Warga"}
            </button>
          </div>
        </div>
      </div>

      {/* User Details Modal (Resident Identity Card Style) */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-[75] flex justify-center items-center p-4 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null);
          }}
        >
          <div
            className="relative w-full max-w-[420px] bg-white dark:bg-[#131c33] rounded-[24px] shadow-2xl border border-gray-100 dark:border-slate-800/85 overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 translate-y-0 animate-[scaleUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
          >
            {/* Glowing Top Ribbon */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 z-20 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 border-none rounded-full p-2 cursor-pointer text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center active:scale-95"
            >
              <X size={16} />
            </button>

            {/* Content Area */}
            <div className="p-6 flex flex-col gap-5">
              
              {/* Header Title */}
              <div className="text-left mt-1">
                <h3 className="text-[17px] font-black text-gray-800 dark:text-white m-0 tracking-wide">
                  Kartu Identitas Warga
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 m-0 mt-0.5 leading-normal">
                  Dokumen digital keanggotaan lingkungan perumahan
                </p>
              </div>

              {/* Resident Identity Card (Copied directly from Profile.jsx) */}
              <div
                className="relative overflow-hidden text-white rounded-2xl shadow-xl transition-all duration-300 select-none border border-white/10 w-full"
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
                        {selectedUser.url_foto_profil ? (
                          <img
                            src={selectedUser.url_foto_profil}
                            alt="Foto Profil"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-3xl font-black tracking-widest shadow-inner">
                            {getInitials(selectedUser.nama)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 flex flex-col gap-2.5 pb-0.5">
                      <div className="flex flex-col">
                        <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Nama Lengkap</span>
                        <span className="text-[15px] font-black tracking-wide text-white leading-none uppercase drop-shadow-xs truncate max-w-[170px]">
                          {selectedUser.nama || "Nama Warga"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Blok Rumah</span>
                          <span className="text-[11px] font-bold text-white uppercase leading-none truncate">{selectedUser.blok_rumah || "-"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Status Warga</span>
                          <span className={`text-[11px] font-bold uppercase leading-none truncate ${
                            selectedUser.status_warga === 'tetap' ? 'text-emerald-400' :
                            selectedUser.status_warga === 'kontrak' ? 'text-indigo-400' :
                            selectedUser.status_warga === 'kos' ? 'text-amber-400' :
                            'text-rose-400'
                          }`}>{selectedUser.status_warga || "Tetap"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer */}
                  <div className="flex justify-between items-end border-t border-white/10 pt-2.5 mt-2">
                    <div className="flex items-center gap-1.5 opacity-90">
                      <ShieldCheck size={11} className="text-emerald-400" />
                      <span className="text-[9px] uppercase tracking-wider font-bold text-white">{selectedUser.role || "warga"}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Phone Number</span>
                      <span className="text-[10px] font-mono tracking-widest text-white/90">{selectedUser.no_hp || "-"}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action and Detail buttons */}
              <div className="flex flex-col gap-2.5 mt-2">
                {selectedUser.no_hp && (
                  <a
                    href={`https://wa.me/${selectedUser.no_hp.replace(/^0/, "62")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#25d366] hover:bg-[#20ba5a] text-white rounded-xl text-[13px] font-bold cursor-pointer transition-colors border-none shadow-sm text-center no-underline"
                  >
                    Hubungi via WhatsApp
                  </a>
                )}
                
                <div className="flex gap-2">
                  {(currentUser?.role === "admin" || selectedUser.id_user === currentUser?.id_user) && (
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        openEdit(selectedUser);
                      }}
                      className="flex-1 py-3 bg-blue-50 dark:bg-slate-800/60 hover:bg-blue-100 dark:hover:bg-slate-700/60 text-blue-600 dark:text-indigo-400 rounded-xl text-[13px] font-bold cursor-pointer transition-colors border-none"
                    >
                      Ubah Data
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 text-gray-600 dark:text-gray-400 rounded-xl text-[13px] font-bold cursor-pointer transition-colors border-none"
                  >
                    Tutup
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
