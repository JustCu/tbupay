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

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama, blok, atau role..."
          className="w-full p-[10px_12px_10px_38px] border border-gray-200 rounded-xl bg-white text-[13px] outline-none font-sans focus:border-blue-600"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((user) => (
            <div key={user.id_user} className="bg-white dark:bg-[#1a2640] rounded-2xl border border-gray-100 dark:border-slate-800/80 p-[14px_16px] flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-extrabold shrink-0 ${
                user.role === 'warga' ? 'bg-blue-100 text-blue-700' :
                user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                'bg-cyan-100 text-cyan-700'
              }`}>
                {user.nama?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis">{user.nama}</div>
                <div className="text-[11px] text-gray-400 mt-[2px] flex items-center gap-1.5">
                  <span>{user.blok_rumah}</span>
                  {user.no_hp && <span>· {user.no_hp}</span>}
                </div>
                <div className="flex gap-1.5 mt-1 items-center flex-wrap">
                  <span className={`text-[10px] font-bold p-[2px_8px] rounded-full capitalize inline-block ${
                    user.role === 'warga' ? 'bg-blue-100 text-blue-700' :
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    'bg-cyan-100 text-cyan-700'
                  }`}>
                    {user.role}
                  </span>
                  {user.status_warga && (
                    <span className={`text-[10px] font-bold p-[2px_8px] rounded-full capitalize inline-block border ${
                      user.status_warga === 'tetap' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      user.status_warga === 'kontrak' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      user.status_warga === 'kos' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {user.status_warga}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {(currentUser?.role === "admin" || user.id_user === currentUser?.id_user) && (
                  <button
                    className="w-[34px] h-[34px] rounded-lg border-none cursor-pointer flex items-center justify-center transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100"
                    onClick={() => openEdit(user)}
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {currentUser?.role === "admin" && (
                  <button
                    className="w-[34px] h-[34px] rounded-lg border-none cursor-pointer flex items-center justify-center transition-colors bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDelete(user)}
                    title="Hapus"
                    disabled={user.id_user === currentUser?.id_user}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      <div
        className={`fixed inset-0 z-[70] flex justify-center items-end bg-transparent pointer-events-none transition-colors duration-300 ${isFormOpen ? "bg-black/50 pointer-events-auto" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeForm();
        }}
      >
        <div className={`w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-3xl p-[24px_20px] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col gap-[14px] max-h-[85vh] overflow-y-auto ${isFormOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 m-0">
              {editTarget ? "Edit Warga" : "Tambah Warga Baru"}
            </h3>
            <button
              onClick={closeForm}
              className="bg-gray-100 dark:bg-slate-800/60 border-none rounded-full p-2 cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase">Nama Lengkap</label>
            <input
              className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
              type="text"
              placeholder="Contoh: Pak Budi Santoso"
              value={form.nama}
              onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase">Blok / Username</label>
              <input
                className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
                type="text"
                placeholder="A-12"
                value={form.blok_rumah}
                onChange={(e) =>
                  setForm((p) => ({ ...p, blok_rumah: e.target.value }))
                }
              />
              <span className="text-[10px] text-gray-400 mt-[2px]">
                Digunakan sebagai username login
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase">No. HP</label>
              <input
                className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={form.no_hp}
                onChange={(e) =>
                  setForm((p) => ({ ...p, no_hp: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
             <div className="flex flex-col gap-1">
               <label className="text-[11px] font-bold text-gray-500 uppercase">Role</label>
               <select
                 className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white disabled:opacity-60"
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
             <div className="flex flex-col gap-1">
               <label className="text-[11px] font-bold text-gray-500 uppercase">Status Warga</label>
               <select
                 className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
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

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase">Password</label>
            <input
              className="w-full p-[11px_13px] border border-gray-200 rounded-xl bg-gray-50 text-[14px] outline-none font-sans box-border focus:border-blue-600 focus:bg-white"
              type="password"
              placeholder={
                editTarget ? "(biarkan kosong)" : "Default: 123456"
              }
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
            />
            {editTarget && (
              <span className="text-[10px] text-gray-400 mt-[2px]">Kosongkan jika tidak diubah</span>
            )}
          </div>

          {formError && (
            <div className="bg-red-100 text-red-600 rounded-lg p-[10px_14px] text-[13px] font-semibold border border-red-200">
              ⚠️ {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <button className="p-3 rounded-xl border border-gray-200 bg-white text-[14px] font-bold text-gray-500 cursor-pointer transition-colors hover:bg-gray-50" onClick={closeForm}>
              Batal
            </button>
            <button className="p-3 rounded-xl border-none bg-[#0f4c81] text-white text-[14px] font-bold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(15,76,129,0.2)]" onClick={handleSave} disabled={saving}>
              {saving
                ? "Menyimpan..."
                : editTarget
                  ? "Simpan Perubahan"
                  : "Tambah Warga"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
