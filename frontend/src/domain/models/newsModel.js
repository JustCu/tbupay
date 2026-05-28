const toValidDateString = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

export const toNewsModel = (raw = {}) => ({
  id_berita: String(raw.id_berita || ""),
  judul: String(raw.judul || ""),
  konten: String(raw.konten || raw.isi || ""),
  tanggal: toValidDateString(raw.tanggal) || String(raw.tanggal || ""),
});

export const toNewsReplyModel = (raw = {}) => ({
  id_balasan: String(raw.id_balasan || ""),
  id_berita: String(raw.id_berita || ""),
  id_user: String(raw.id_user || ""),
  nama_pengirim: String(raw.nama_pengirim || "Pengguna"),
  isi_balasan: String(raw.isi_balasan || ""),
  role_pengirim: String(raw.role_pengirim || ""),
  timestamp: toValidDateString(raw.timestamp) || String(raw.timestamp || ""),
});
