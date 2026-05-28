export const toUserModel = (raw = {}) => ({
  id_user: String(raw.id_user || ""),
  nama: String(raw.nama || ""),
  blok_rumah: String(raw.blok_rumah || ""),
  no_hp: String(raw.no_hp || ""),
  role: String(raw.role || "warga"),
  status_warga: String(raw.status_warga || "tetap"),
  url_foto_profil: String(raw.url_foto_profil || ""),
});
