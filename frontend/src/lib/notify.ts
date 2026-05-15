import Swal from "sweetalert2";

const defaults = {
  confirmButtonColor: "#44403c",
  cancelButtonColor: "#78716c",
  color: "#1c1917",
  background: "#fafaf9",
  backdrop: "rgba(15, 23, 42, 0.45)",
  showClass: {
    popup: "swal-animate-in",
    backdrop: "swal-backdrop-in",
  },
  hideClass: {
    popup: "swal-animate-out",
    backdrop: "swal-backdrop-out",
  },
} as const;

export function notifySuccess(title: string, text?: string) {
  return Swal.fire({
    ...defaults,
    icon: "success",
    title,
    text: text || undefined,
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "swal-popup-rounded",
      confirmButton: "swal-btn-confirm",
    },
  });
}

export function notifyError(title: string, text?: string) {
  return Swal.fire({
    ...defaults,
    icon: "error",
    title,
    text: text || undefined,
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "swal-popup-rounded",
      confirmButton: "swal-btn-confirm",
    },
  });
}

export function notifyInfo(title: string, text?: string) {
  return Swal.fire({
    ...defaults,
    icon: "info",
    title,
    text: text || undefined,
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "swal-popup-rounded",
      confirmButton: "swal-btn-confirm",
    },
  });
}

/** ยืนยันก่อนทำรายการที่ทำแล้วย้อนกลับยาก */
export async function notifyConfirm(
  title: string,
  text?: string,
  options?: { confirmText?: string; cancelText?: string },
): Promise<boolean> {
  const r = await Swal.fire({
    ...defaults,
    icon: "warning",
    title,
    text: text || undefined,
    showCancelButton: true,
    confirmButtonText: options?.confirmText ?? "ยืนยัน",
    cancelButtonText: options?.cancelText ?? "ยกเลิก",
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      popup: "swal-popup-rounded",
      confirmButton: "swal-btn-confirm",
      cancelButton: "swal-btn-cancel",
    },
  });
  return r.isConfirmed;
}
