"use client";

import { useState } from "react";

interface ConfirmDialogProps {
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message = "本当に削除しますか？この操作は取り消せません。",
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-in fade-in duration-200">
      <p className="text-sm text-red-700 flex-1">{message}</p>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

// Hook for managing confirm state
export function useConfirmDialog() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const requestConfirm = (id: string) => setConfirmingId(id);
  const cancelConfirm = () => setConfirmingId(null);
  const isConfirming = (id: string) => confirmingId === id;

  return { confirmingId, requestConfirm, cancelConfirm, isConfirming };
}
