// TBU Pay - Google Apps Script Backend
// Deploy as Web App (Execute as: Me, Who has access: Anyone)

const SPREADSHEET_ID = "1KAuvNGYN-BO3A3uG7dbqXlNHcscFR9zXIr_jCJg3Msk";
const DRIVE_FOLDER_ID = "1_rF1loC2ppC2Eg1TEauDGO1vx_-Q-fxW";
const DEFAULT_PEMASUKAN_CATEGORIES = [
  "Kas Rutin",
  "Sumbangan Sosial",
  "Kebersihan Ekstra",
];
const DEFAULT_PENGELUARAN_CATEGORIES = [
  "Operasional RT",
  "Perawatan Lingkungan",
  "Keamanan",
  "Kebersihan",
  "Lainnya",
];

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === "login") {
      return handleLogin(postData);
    } else if (action === "addTransaction") {
      return handleAddTransaction(postData);
    } else if (action === "verifyTransaction") {
      return handleVerifyTransaction(postData);
    } else if (action === "addTicket") {
      return handleAddTicket(postData);
    } else if (action === "updateTicketStatus") {
      return handleUpdateTicketStatus(postData);
    } else if (action === "addUser") {
      return handleAddUser(postData);
    } else if (action === "updateUser") {
      return handleUpdateUser(postData);
    } else if (action === "deleteUser") {
      return handleDeleteUser(postData);
    } else if (action === "addNews") {
      return handleAddNews(postData);
    } else if (action === "addNewsReply") {
      return handleAddNewsReply(postData);
    } else if (action === "addTicketReply") {
      return handleAddTicketReply(postData);
    } else if (action === "addTransactionCategory") {
      return handleAddTransactionCategory(postData);
    } else if (action === "deleteTransactionCategory") {
      return handleDeleteTransactionCategory(postData);
    } else if (action === "reorderTransactionCategories") {
      return handleReorderTransactionCategories(postData);
    } else if (action === "addGeneralChat") {
      return handleAddGeneralChat(postData);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Action not found" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === "getTransactions") {
      return handleGetTransactions(e.parameter.id_user);
    } else if (action === "getTickets") {
      return handleGetTickets();
    } else if (action === "getNews") {
      return handleGetNews();
    } else if (action === "getUsers") {
      return handleGetUsers();
    } else if (action === "getTransactionCategories") {
      return handleGetTransactionCategories();
    } else if (action === "getNewsReplies") {
      return handleGetNewsReplies(e.parameter.id_berita);
    } else if (action === "getTicketReplies") {
      return handleGetTicketReplies(e.parameter.id_tiket);
    } else if (action === "getGeneralChats") {
      return handleGetGeneralChats();
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Action not found" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ================= HANDLERS =================

function handleLogin(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_users");
  const rows = sheet.getDataRange().getValues();
  // id_user, nama, blok_rumah, no_hp, role, password_hash, status_warga

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id_user = row[0];
    const nama = row[1];
    const blok_rumah = row[2];
    const no_hp = row[3];
    const role = row[4];
    const password_hash = row[5];
    const status_warga = row[6] || "tetap";
    const url_foto_profil = row[7] || "";

    // Convert to String to prevent type mismatch (e.g. 123456 as Number vs '123456' as String)
    const strBlok = String(blok_rumah).trim();
    const strHp = String(no_hp).trim();
    const strPass = String(password_hash).trim();
    const inputUser = String(data.username).trim();
    const inputPass = String(data.password).trim();

    if (
      (strBlok === inputUser || strHp === inputUser) &&
      strPass === inputPass
    ) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          user: { id_user, nama, blok_rumah, no_hp, role, status_warga, url_foto_profil },
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: "Invalid credentials" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleGetTransactions(id_user) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_transaksi");
  const rows = sheet.getDataRange().getValues();
  // id_transaksi, id_user, jenis, nominal, keterangan, url_bukti, status, timestamp

  let transactions = [];
  for (let i = 1; i < rows.length; i++) {
    // If id_user is provided and this row doesn't match (and we only want user specific data), skip
    // Wait, in PRD "Dasbor overview keuangan perumahan", so we might want all if admin/all, or just for cashflow overview.
    // Let's return all, frontend can filter.
    transactions.push({
      id_transaksi: rows[i][0],
      id_user: rows[i][1],
      jenis: rows[i][2],
      nominal: rows[i][3],
      keterangan: rows[i][4],
      url_bukti: rows[i][5],
      status: rows[i][6],
      timestamp: rows[i][7],
    });
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: transactions }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddTransaction(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_transaksi");
  let url_bukti = "";

  const now = new Date();

  if (data.imageBase64) {
    // --- Struktur folder: DRIVE_ROOT/bukti/YYYY-MM/ ---
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    // Cari atau buat folder "bukti"
    var buktiFolderIter = rootFolder.getFoldersByName("bukti");
    var buktiFolder = buktiFolderIter.hasNext()
      ? buktiFolderIter.next()
      : rootFolder.createFolder("bukti");

    // Cari atau buat subfolder tahun-bulan (contoh: "2026-05")
    var yearMonth =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0");
    var monthFolderIter = buktiFolder.getFoldersByName(yearMonth);
    var monthFolder = monthFolderIter.hasNext()
      ? monthFolderIter.next()
      : buktiFolder.createFolder(yearMonth);

    // --- Nama file: YYYYMMDD-ID_USER-KODE_UNIK ---
    var datePrefix =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    var userId = String(data.id_user || "UNKNOWN").toUpperCase().replace(/\s+/g, "_");
    var shortUuid = Utilities.getUuid().split("-")[0]; // 8 karakter unik
    var fileName = datePrefix + "-" + userId + "-" + shortUuid;

    var contentType = data.imageBase64.match(
      /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/,
    )[1];
    var base64Data = data.imageBase64.split(",")[1];
    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      contentType,
      fileName,
    );
    var file = monthFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // URL lh3.googleusercontent.com — bisa langsung diembed di <img> tanpa blokir
    url_bukti =
      "https://lh3.googleusercontent.com/d/" + file.getId() + "=s800";
  }

  const id_transaksi = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  const isAdminEntry = String(data.created_by_role || "") === "admin";
  const isPengeluaran = String(data.jenis || "") === "pengeluaran";
  const initialStatus = isAdminEntry || isPengeluaran ? "verified" : "pending";

  sheet.appendRow([
    id_transaksi,
    data.id_user,
    data.jenis, // 'pemasukan' | 'pengeluaran'
    data.nominal,
    data.keterangan,
    url_bukti,
    initialStatus,
    timestamp,
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "Transaction added",
      url: url_bukti,
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleVerifyTransaction(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_transaksi");
  const rows = sheet.getDataRange().getValues();
  // Columns: id_transaksi(0), id_user(1), jenis(2), nominal(3), keterangan(4), url_bukti(5), status(6), timestamp(7)

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id_transaksi)) {
      const newStatus = data.action_type === "reject" ? "rejected" : "verified";
      sheet.getRange(i + 1, 7).setValue(newStatus); // col 7 = status
      if (data.catatan_admin) {
        // Append admin note to keterangan
        const existingKet = String(rows[i][4]);
        sheet
          .getRange(i + 1, 5)
          .setValue(existingKet + " [Admin: " + data.catatan_admin + "]");
      }
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          message: "Transaction " + newStatus,
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: "Transaction not found" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleGetTickets() {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_tiket_layanan");
  const rows = sheet.getDataRange().getValues();

  let tickets = [];
  for (let i = 1; i < rows.length; i++) {
    tickets.push({
      id_tiket: rows[i][0],
      id_user_pelapor: rows[i][1],
      kategori: rows[i][2],
      deskripsi: rows[i][3],
      url_foto_kondisi: rows[i][4],
      status: rows[i][5],
      id_petugas_pic: rows[i][6],
      timestamp: rows[i][7],
    });
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: tickets }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddTicket(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_tiket_layanan");
  let url_foto_kondisi = "";

  if (data.imageBase64) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const contentType = data.imageBase64.match(
      /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/,
    )[1];
    const base64Data = data.imageBase64.split(",")[1];
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      contentType,
      "tiket_" + Date.now(),
    );
    const file = folder.createFile(blob);
    url_foto_kondisi = file.getUrl();
  }

  const id_tiket = Utilities.getUuid();
  const timestamp = new Date().toISOString();

  sheet.appendRow([
    id_tiket,
    data.id_user_pelapor,
    data.kategori, // 'keluhan' | 'saran'
    data.deskripsi,
    url_foto_kondisi,
    "open",
    "", // id_petugas_pic (empty initially)
    timestamp,
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "Ticket added" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateTicketStatus(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_tiket_layanan");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id_tiket) {
      sheet.getRange(i + 1, 6).setValue(data.status); // Kolom ke-6 adalah 'status'
      if (data.id_petugas_pic) {
        sheet.getRange(i + 1, 7).setValue(data.id_petugas_pic); // Kolom ke-7 adalah 'id_petugas_pic'
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", message: "Ticket updated" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: "Ticket not found" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleGetNews() {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_berita");
  const rows = sheet.getDataRange().getValues();

  let news = [];
  for (let i = 1; i < rows.length; i++) {
    news.push({
      id_berita: rows[i][0],
      judul: rows[i][1],
      konten: rows[i][2],
      tanggal: rows[i][3],
    });
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: news }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddNews(data) {
  if (String(data.created_by_role || "") !== "admin") {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Hanya admin yang dapat menambahkan berita.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const judul = String(data.judul || "").trim();
  const konten = String(data.konten || "").trim();
  if (!judul || !konten) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Judul dan konten berita wajib diisi.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_berita");
  const id_berita = Utilities.getUuid();
  const tanggal = new Date().toISOString();
  sheet.appendRow([id_berita, judul, konten, tanggal]);

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "Berita berhasil dipublikasikan.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleGetNewsReplies(id_berita) {
  const targetNewsId = String(id_berita || "").trim();
  if (!targetNewsId) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "id_berita wajib diisi." }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_berita_balasan");
  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", data: [] }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const rows = sheet.getDataRange().getValues();
  const replies = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== targetNewsId) continue;
    replies.push({
      id_balasan: rows[i][0],
      id_berita: rows[i][1],
      id_user: rows[i][2],
      nama_pengirim: rows[i][3],
      isi_balasan: rows[i][4],
      timestamp: rows[i][5],
    });
  }

  replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: replies }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddNewsReply(data) {
  const idBerita = String(data.id_berita || "").trim();
  const isiBalasan = String(data.isi_balasan || "").trim();
  const idUser = String(data.id_user || "").trim();
  const namaPengirim = String(data.nama_pengirim || "").trim();

  if (!idBerita || !isiBalasan) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "ID berita dan isi balasan wajib diisi.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const newsSheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_berita");
  const newsRows = newsSheet ? newsSheet.getDataRange().getValues() : [];
  const hasNews = newsRows.some(
    (row, idx) => idx > 0 && String(row[0]) === idBerita,
  );
  if (!hasNews) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Berita tidak ditemukan." }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const replySheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_berita_balasan");
  if (!replySheet) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Tabel balasan berita belum tersedia.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  replySheet.appendRow([
    Utilities.getUuid(),
    idBerita,
    idUser || "anonymous",
    namaPengirim || "Pengguna",
    isiBalasan,
    new Date().toISOString(),
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "Balasan berhasil dikirim." }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function ensureTransactionCategorySheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("tb_kategori_transaksi");
  if (!sheet) {
    sheet = ss.insertSheet("tb_kategori_transaksi");
    sheet
      .getRange(1, 1, 1, 5)
      .setValues([
        [
          "id_kategori",
          "jenis_transaksi",
          "nama_kategori",
          "created_at",
          "sort_order",
        ],
      ]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }

  if (sheet.getLastColumn() < 5) {
    sheet.insertColumnAfter(4);
    sheet.getRange(1, 5).setValue("sort_order").setFontWeight("bold");
  }

  if (sheet.getLastRow() <= 1) {
    const now = new Date().toISOString();
    const seedRows = [];
    DEFAULT_PEMASUKAN_CATEGORIES.forEach((name, idx) => {
      seedRows.push([Utilities.getUuid(), "pemasukan", name, now, idx + 1]);
    });
    DEFAULT_PENGELUARAN_CATEGORIES.forEach((name, idx) => {
      seedRows.push([Utilities.getUuid(), "pengeluaran", name, now, idx + 1]);
    });
    if (seedRows.length > 0) {
      sheet.getRange(2, 1, seedRows.length, 5).setValues(seedRows);
    }
  } else {
    // Backfill sort order for legacy rows that were created before sort_order existed.
    const rows = sheet.getDataRange().getValues();
    const nextOrder = { pemasukan: 1, pengeluaran: 1 };
    for (let i = 1; i < rows.length; i++) {
      const jenis = String(rows[i][1] || "").trim();
      if (!["pemasukan", "pengeluaran"].includes(jenis)) continue;
      const currentOrder = Number(rows[i][4]);
      if (!currentOrder || currentOrder <= 0) {
        sheet.getRange(i + 1, 5).setValue(nextOrder[jenis]);
      }
      nextOrder[jenis] += 1;
    }
  }

  return sheet;
}

function handleGetTransactionCategories() {
  const sheet = ensureTransactionCategorySheet();
  const rows = sheet.getDataRange().getValues();
  const pemasukan = [];
  const pengeluaran = [];

  for (let i = 1; i < rows.length; i++) {
    const jenis = String(rows[i][1] || "").trim();
    const nama = String(rows[i][2] || "").trim();
    const order = Number(rows[i][4] || 9999);
    if (!nama) continue;
    if (jenis === "pengeluaran") pengeluaran.push({ nama, order });
    else pemasukan.push({ nama, order });
  }

  pemasukan.sort((a, b) => a.order - b.order);
  pengeluaran.sort((a, b) => a.order - b.order);

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      data: {
        pemasukan:
          pemasukan.length > 0
            ? pemasukan.map((x) => x.nama)
            : DEFAULT_PEMASUKAN_CATEGORIES,
        pengeluaran:
          pengeluaran.length > 0
            ? pengeluaran.map((x) => x.nama)
            : DEFAULT_PENGELUARAN_CATEGORIES,
      },
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddTransactionCategory(data) {
  if (String(data.created_by_role || "") !== "admin") {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Hanya admin yang dapat mengubah kategori.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const jenis = String(data.jenis_transaksi || "").trim();
  const nama = String(data.nama_kategori || "").trim();
  if (!["pemasukan", "pengeluaran"].includes(jenis)) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Jenis transaksi tidak valid.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
  if (!nama) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Nama kategori wajib diisi.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = ensureTransactionCategorySheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowJenis = String(rows[i][1] || "").trim();
    const rowNama = String(rows[i][2] || "")
      .trim()
      .toLowerCase();
    if (rowJenis === jenis && rowNama === nama.toLowerCase()) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Kategori sudah ada." }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const rowsForOrder = sheet.getDataRange().getValues();
  let maxOrder = 0;
  for (let i = 1; i < rowsForOrder.length; i++) {
    const rowJenis = String(rowsForOrder[i][1] || "").trim();
    if (rowJenis !== jenis) continue;
    maxOrder = Math.max(maxOrder, Number(rowsForOrder[i][4] || 0));
  }

  sheet.appendRow([
    Utilities.getUuid(),
    jenis,
    nama,
    new Date().toISOString(),
    maxOrder + 1,
  ]);
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "Kategori berhasil ditambahkan.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleDeleteTransactionCategory(data) {
  if (String(data.created_by_role || "") !== "admin") {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Hanya admin yang dapat mengubah kategori.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const jenis = String(data.jenis_transaksi || "").trim();
  const nama = String(data.nama_kategori || "").trim();
  if (!["pemasukan", "pengeluaran"].includes(jenis) || !nama) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Data kategori tidak valid.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = ensureTransactionCategorySheet();
  const rows = sheet.getDataRange().getValues();
  let sameTypeCount = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || "").trim() === jenis) sameTypeCount++;
  }
  if (sameTypeCount <= 1) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Minimal harus ada 1 kategori untuk tiap jenis transaksi.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  for (let i = 1; i < rows.length; i++) {
    const rowJenis = String(rows[i][1] || "").trim();
    const rowNama = String(rows[i][2] || "").trim();
    if (rowJenis === jenis && rowNama.toLowerCase() === nama.toLowerCase()) {
      sheet.deleteRow(i + 1);
      reindexCategorySortOrderByType(sheet, jenis);
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          message: "Kategori berhasil dihapus.",
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: "Kategori tidak ditemukan." }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleReorderTransactionCategories(data) {
  if (String(data.created_by_role || "") !== "admin") {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Hanya admin yang dapat mengubah kategori.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const jenis = String(data.jenis_transaksi || "").trim();
  const orderedNames = Array.isArray(data.ordered_names)
    ? data.ordered_names
    : [];
  if (!orderedNames.length || !["pemasukan", "pengeluaran"].includes(jenis)) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Data urutan kategori tidak valid.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = ensureTransactionCategorySheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndexByName = {};
  for (let i = 1; i < rows.length; i++) {
    const rowJenis = String(rows[i][1] || "").trim();
    if (rowJenis !== jenis) continue;
    const rowNama = String(rows[i][2] || "").trim();
    rowIndexByName[rowNama.toLowerCase()] = i + 1;
  }

  for (let i = 0; i < orderedNames.length; i++) {
    const name = String(orderedNames[i] || "").trim();
    const rowIndex = rowIndexByName[name.toLowerCase()];
    if (rowIndex) {
      sheet.getRange(rowIndex, 5).setValue(i + 1);
    }
  }

  reindexCategorySortOrderByType(sheet, jenis);
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "Urutan kategori diperbarui.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function reindexCategorySortOrderByType(sheet, jenis) {
  const rows = sheet.getDataRange().getValues();
  const targetRows = [];
  for (let i = 1; i < rows.length; i++) {
    const rowJenis = String(rows[i][1] || "").trim();
    if (rowJenis !== jenis) continue;
    targetRows.push({
      rowIndex: i + 1,
      order: Number(rows[i][4] || 9999),
      name: String(rows[i][2] || "")
        .trim()
        .toLowerCase(),
    });
  }

  targetRows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name);
  });

  targetRows.forEach((entry, idx) => {
    sheet.getRange(entry.rowIndex, 5).setValue(idx + 1);
  });
}

// Function to handle OPTIONS request (CORS)
function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(
    ContentService.MimeType.JSON,
  );
}

// ================= INITIALIZATION =================
// Run this function ONCE from the Apps Script Editor to setup the spreadsheet
function initSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const tables = [
    {
      name: "tb_users",
      headers: [
        "id_user",
        "nama",
        "blok_rumah",
        "no_hp",
        "role",
        "password_hash",
        "status_warga",
        "url_foto_profil",
      ],
    },
    {
      name: "tb_transaksi",
      headers: [
        "id_transaksi",
        "id_user",
        "jenis",
        "nominal",
        "keterangan",
        "url_bukti",
        "status",
        "timestamp",
      ],
    },
    {
      name: "tb_tiket_layanan",
      headers: [
        "id_tiket",
        "id_user_pelapor",
        "kategori",
        "deskripsi",
        "url_foto_kondisi",
        "status",
        "id_petugas_pic",
        "timestamp",
      ],
    },
    {
      name: "tb_berita",
      headers: ["id_berita", "judul", "konten", "tanggal"],
    },
    {
      name: "tb_berita_balasan",
      headers: [
        "id_balasan",
        "id_berita",
        "id_user",
        "nama_pengirim",
        "isi_balasan",
        "timestamp",
      ],
    },
    {
      name: "tb_kategori_transaksi",
      headers: [
        "id_kategori",
        "jenis_transaksi",
        "nama_kategori",
        "created_at",
        "sort_order",
      ],
    },
  ];

  tables.forEach((table) => {
    let sheet = ss.getSheetByName(table.name);
    if (!sheet) {
      sheet = ss.insertSheet(table.name);
    }

    // Set headers
    sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers]);
    sheet.getRange(1, 1, 1, table.headers.length).setFontWeight("bold");
  });

  // Insert mock users if tb_users has no data
  const userSheet = ss.getSheetByName("tb_users");
  if (userSheet.getLastRow() <= 1) {
    userSheet.appendRow([
      "admin-001",
      "Admin",
      "Kantor",
      "08111111",
      "admin",
      "123456",
      "tetap",
      "",
    ]);
    userSheet.appendRow([
      "warga-001",
      "Pak Budi",
      "A-12",
      "08222222",
      "warga",
      "123456",
      "tetap",
      "",
    ]);
    userSheet.appendRow([
      "petugas-001",
      "Pak Satpam",
      "Pos Jaga",
      "08333333",
      "petugas",
      "123456",
      "tetap",
      "",
    ]);
  }

  // Seed default transaction categories if empty
  const categorySheet = ss.getSheetByName("tb_kategori_transaksi");
  if (categorySheet && categorySheet.getLastRow() <= 1) {
    const now = new Date().toISOString();
    const seedRows = [];
    DEFAULT_PEMASUKAN_CATEGORIES.forEach((name, idx) => {
      seedRows.push([Utilities.getUuid(), "pemasukan", name, now, idx + 1]);
    });
    DEFAULT_PENGELUARAN_CATEGORIES.forEach((name, idx) => {
      seedRows.push([Utilities.getUuid(), "pengeluaran", name, now, idx + 1]);
    });
    if (seedRows.length > 0) {
      categorySheet.getRange(2, 1, seedRows.length, 5).setValues(seedRows);
    }
  }
}

// ================= USER MANAGEMENT =================
// Columns: id_user(0), nama(1), blok_rumah(2), no_hp(3), role(4), password_hash(5), status_warga(6)

function handleGetUsers() {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_users");
  const rows = sheet.getDataRange().getValues();
  let users = [];
  for (let i = 1; i < rows.length; i++) {
    users.push({
      id_user: rows[i][0],
      nama: rows[i][1],
      blok_rumah: rows[i][2],
      no_hp: String(rows[i][3]),
      role: rows[i][4],
      status_warga: rows[i][6] || "tetap",
      url_foto_profil: rows[i][7] || "",
      // never return password hash
    });
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: users }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddUser(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_users");
  const rows = sheet.getDataRange().getValues();

  // Check duplicate blok_rumah
  for (let i = 1; i < rows.length; i++) {
    if (
      String(rows[i][2]).trim().toLowerCase() ===
      String(data.blok_rumah).trim().toLowerCase()
    ) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "error",
          message: "Blok/username sudah terdaftar.",
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const id_user = (data.role || "warga") + "-" + Date.now();
  sheet.appendRow([
    id_user,
    data.nama,
    data.blok_rumah,
    data.no_hp || "",
    data.role || "warga",
    data.password || "123456",
    data.status_warga || "tetap",
    "",
  ]);
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "User berhasil ditambahkan",
      id_user,
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateUser(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_users");
  const rows = sheet.getDataRange().getValues();

  let url_foto_profil = "";
  if (data.imageBase64) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var profileFolderIter = rootFolder.getFoldersByName("profil");
    var profileFolder = profileFolderIter.hasNext()
      ? profileFolderIter.next()
      : rootFolder.createFolder("profil");

    var fileName = "profil-" + data.id_user + "-" + Date.now();
    var contentType = data.imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)[1];
    var base64Data = data.imageBase64.split(",")[1];
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, fileName);
    var file = profileFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    url_foto_profil = "https://lh3.googleusercontent.com/d/" + file.getId() + "=s800";
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id_user)) {
      if (data.nama) sheet.getRange(i + 1, 2).setValue(data.nama);
      if (data.blok_rumah) sheet.getRange(i + 1, 3).setValue(data.blok_rumah);
      if (data.no_hp !== undefined) sheet.getRange(i + 1, 4).setValue(data.no_hp);
      if (data.role) sheet.getRange(i + 1, 5).setValue(data.role);
      if (data.password) sheet.getRange(i + 1, 6).setValue(data.password);
      if (data.status_warga) sheet.getRange(i + 1, 7).setValue(data.status_warga);
      if (url_foto_profil) sheet.getRange(i + 1, 8).setValue(url_foto_profil);

      const finalUrlFoto = url_foto_profil || String(rows[i][7] || "");

      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", message: "User diperbarui", url_foto_profil: finalUrlFoto })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: "User tidak ditemukan" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleDeleteUser(data) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("tb_users");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id_user)) {
      // Prevent deleting the only admin
      if (rows[i][4] === "admin") {
        const adminCount = rows.slice(1).filter((r) => r[4] === "admin").length;
        if (adminCount <= 1) {
          return ContentService.createTextOutput(
            JSON.stringify({
              status: "error",
              message: "Tidak dapat menghapus satu-satunya admin.",
            }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      sheet.deleteRow(i + 1);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", message: "User dihapus" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: "User tidak ditemukan" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleGetTicketReplies(id_tiket) {
  const targetTicketId = String(id_tiket || "").trim();
  if (!targetTicketId) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "id_tiket wajib diisi." }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("tb_tiket_balasan");
  if (!sheet) {
    sheet = ss.insertSheet("tb_tiket_balasan");
    sheet.appendRow(["id_balasan", "id_tiket", "id_user", "nama_pengirim", "role_pengirim", "isi_balasan", "timestamp"]);
  }

  const rows = sheet.getDataRange().getValues();
  const replies = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== targetTicketId) continue;
    replies.push({
      id_balasan: rows[i][0],
      id_tiket: rows[i][1],
      id_user: rows[i][2],
      nama_pengirim: rows[i][3],
      role_pengirim: rows[i][4],
      isi_balasan: rows[i][5],
      timestamp: rows[i][6]
    });
  }

  replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: replies }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddTicketReply(data) {
  const idTiket = String(data.id_tiket || "").trim();
  const isiBalasan = String(data.isi_balasan || "").trim();
  const idUser = String(data.id_user || "").trim();
  const namaPengirim = String(data.nama_pengirim || "").trim();
  const rolePengirim = String(data.role_pengirim || "warga").trim();

  if (!idTiket || !isiBalasan) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "ID tiket dan isi balasan wajib diisi.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ticketSheet = ss.getSheetByName("tb_tiket_layanan");
  const ticketRows = ticketSheet ? ticketSheet.getDataRange().getValues() : [];
  const hasTicket = ticketRows.some(
    (row, idx) => idx > 0 && String(row[0]) === idTiket,
  );
  if (!hasTicket) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Tiket keluhan tidak ditemukan." }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  let replySheet = ss.getSheetByName("tb_tiket_balasan");
  if (!replySheet) {
    replySheet = ss.insertSheet("tb_tiket_balasan");
    replySheet.appendRow(["id_balasan", "id_tiket", "id_user", "nama_pengirim", "role_pengirim", "isi_balasan", "timestamp"]);
  }

  replySheet.appendRow([
    Utilities.getUuid(),
    idTiket,
    idUser || "anonymous",
    namaPengirim || "Pengguna",
    rolePengirim,
    isiBalasan,
    new Date().toISOString(),
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "Balasan berhasil dikirim.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleGetGeneralChats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("tb_obrolan_warga");
  if (!sheet) {
    sheet = ss.insertSheet("tb_obrolan_warga");
    sheet.appendRow(["id_chat", "id_user", "nama_pengirim", "role_pengirim", "isi_chat", "timestamp"]);
    // Seed some initial messages
    sheet.appendRow(["seed-1", "system", "Pak RT Budi", "admin", "Selamat datang di Grup Chat Warga! Silakan berinteraksi dengan tertib.", new Date().toISOString()]);
  }

  const rows = sheet.getDataRange().getValues();
  const chats = [];
  for (let i = 1; i < rows.length; i++) {
    chats.push({
      id_chat: rows[i][0],
      id_user: rows[i][1],
      nama_pengirim: rows[i][2],
      role_pengirim: rows[i][3],
      isi_chat: rows[i][4],
      timestamp: rows[i][5]
    });
  }

  chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", data: chats }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleAddGeneralChat(data) {
  const isiChat = String(data.isi_chat || "").trim();
  const idUser = String(data.id_user || "").trim();
  const namaPengirim = String(data.nama_pengirim || "").trim();
  const rolePengirim = String(data.role_pengirim || "warga").trim();

  if (!isiChat) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Isi chat tidak boleh kosong.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("tb_obrolan_warga");
  if (!sheet) {
    sheet = ss.insertSheet("tb_obrolan_warga");
    sheet.appendRow(["id_chat", "id_user", "nama_pengirim", "role_pengirim", "isi_chat", "timestamp"]);
  }

  sheet.appendRow([
    Utilities.getUuid(),
    idUser || "anonymous",
    namaPengirim || "Pengguna",
    rolePengirim,
    isiChat,
    new Date().toISOString(),
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "Pesan berhasil terkirim.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}
