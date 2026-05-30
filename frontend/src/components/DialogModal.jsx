import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, Trash2, X } from "lucide-react";
import useStore from "../store/useStore";

const ICON_MAP = {
  info: <Info size={22} />,
  success: <CheckCircle2 size={22} />,
  warning: <AlertTriangle size={22} />,
  danger: <Trash2 size={22} />,
};

const VARIANT_ICON_STYLES = {
  info: "bg-blue-50 text-blue-500",
  success: "bg-green-50 text-green-500",
  warning: "bg-amber-50 text-amber-500",
  danger: "bg-red-50 text-red-500",
};

const VARIANT_CONFIRM_BUTTON_STYLES = {
  info: "bg-blue-600 hover:bg-blue-700",
  success: "bg-green-600 hover:bg-green-700",
  warning: "bg-amber-500 hover:bg-amber-600",
  danger: "bg-red-600 hover:bg-red-700",
};

const VARIANT_ACCENT = {
  info: "border-blue-400",
  success: "border-green-400",
  warning: "border-amber-400",
  danger: "border-red-400",
};

export default function DialogModal() {
  const dialog = useStore((s) => s.dialog);
  const closeDialog = useStore((s) => s.closeDialog);

  const isOpen = !!dialog;
  const variant = dialog?.variant ?? "info";
  const title = dialog?.title ?? "";
  const message = dialog?.message ?? "";
  const type = dialog?.type ?? "alert"; // 'alert' | 'confirm'
  const confirmLabel = dialog?.confirmLabel ?? "OK";
  const cancelLabel = dialog?.cancelLabel ?? "Batal";

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleConfirm = () => {
    const cb = dialog?.onConfirm;
    closeDialog();
    cb?.();
  };

  const handleCancel = () => {
    const cb = dialog?.onCancel;
    closeDialog();
    cb?.();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (type === "alert") handleConfirm();
      else handleCancel();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex justify-center items-end transition-colors duration-300 ${
        isOpen
          ? "bg-black/50 pointer-events-auto"
          : "bg-transparent pointer-events-none"
      }`}
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-[480px] bg-white dark:bg-[#131c33] rounded-t-[28px] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(calc(100% + 80px))",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="w-[44px] h-[5px] rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className={`flex items-start justify-between p-5 pb-3 border-b-2 ${VARIANT_ACCENT[variant]}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${VARIANT_ICON_STYLES[variant]}`}>
              {ICON_MAP[variant]}
            </div>
            {title && (
              <p className="text-[16px] font-bold text-gray-900 dark:text-gray-100 m-0 leading-snug">
                {title}
              </p>
            )}
          </div>
          <button
            className="p-1.5 bg-gray-100 dark:bg-slate-800/60 rounded-full text-gray-500 dark:text-gray-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-gray-200 dark:hover:bg-slate-700/60 shrink-0 ml-2"
            onClick={type === "alert" ? handleConfirm : handleCancel}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-[14px] text-gray-600 dark:text-gray-300 m-0 leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-8 pt-1">
          {type === "confirm" && (
            <button
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-gray-700 dark:text-gray-300 text-[14px] font-semibold cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/60"
              onClick={handleCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button
            className={`flex-1 py-3 px-4 rounded-xl border-none text-[14px] font-bold cursor-pointer text-white transition-all active:scale-95 ${VARIANT_CONFIRM_BUTTON_STYLES[variant]}`}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
