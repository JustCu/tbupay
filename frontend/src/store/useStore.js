import { create } from "zustand";
import { persist } from "zustand/middleware";

const useStore = create(
  persist(
    (set) => ({
      user: null, // { id_user, nama, blok_rumah, no_hp, role }
      isAuthenticated: false,
      lastActivity: null,
      login: (userData) => set({ user: userData, isAuthenticated: true, lastActivity: Date.now() }),
      logout: () => set({ user: null, isAuthenticated: false, lastActivity: null }),
      updateActivity: () => set((state) => state.isAuthenticated ? { lastActivity: Date.now() } : {}),

      // Chat unread system
      lastReadChatTime: 0,
      unreadChatCount: 0,
      setLastReadChatTime: (time) => set({ lastReadChatTime: time }),
      setUnreadChatCount: (count) => set({ unreadChatCount: count }),

      hasUnreadNotif: false,
      setHasUnreadNotif: (val) => set({ hasUnreadNotif: val }),

      // App Settings
      isDarkMode: false,
      toggleDarkMode: () => set((state) => {
        const next = !state.isDarkMode;
        document.documentElement.classList.toggle("dark", next);
        return { isDarkMode: next };
      }),
      soundVibration: true,
      toggleSoundVibration: () => set((state) => ({ soundVibration: !state.soundVibration })),
      language: "id", // "id" | "en"
      setLanguage: (lang) => set({ language: lang }),

      // Global loading state
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),

      // ── Custom dialog (replaces alert / window.confirm) ──────────────────
      // dialog: null | { type, variant, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }
      dialog: null,

      /** Show an alert-style dialog (single OK button).
       *  @param {string} message
       *  @param {{ title?, variant?, confirmLabel? }} [opts]
       */
      showAlert: (message, opts = {}) =>
        set({
          dialog: {
            type: "alert",
            variant: opts.variant ?? "info",
            title: opts.title ?? "",
            message,
            confirmLabel: opts.confirmLabel ?? "OK",
          },
        }),

      /** Show a confirm-style dialog (Cancel + Confirm buttons).
       *  @param {string} message
       *  @param {Function} onConfirm  called when user presses the confirm button
       *  @param {{ title?, variant?, confirmLabel?, cancelLabel? }} [opts]
       */
      showConfirm: (message, onConfirm, opts = {}) =>
        set({
          dialog: {
            type: "confirm",
            variant: opts.variant ?? "warning",
            title: opts.title ?? "Konfirmasi",
            message,
            confirmLabel: opts.confirmLabel ?? "Ya",
            cancelLabel: opts.cancelLabel ?? "Batal",
            onConfirm,
          },
        }),

      closeDialog: () => set({ dialog: null }),
    }),
    {
      name: "tbu-pay-storage", // name of the item in the storage (must be unique)
    },
  ),
);

export default useStore;
