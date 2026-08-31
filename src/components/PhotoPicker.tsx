"use client";

import { Camera, Image as ImageIcon } from "lucide-react";
import { usePrefs } from "./PrefsProvider";

export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 480;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not process photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          if (!b) reject(new Error("Could not process photo"));
          else resolve(b);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image"));
    };
    img.src = url;
  });
}

export async function postAvatar(file: File, userId?: string): Promise<string> {
  const blob = await compressImage(file);
  const fd = new FormData();
  fd.append("file", blob, "avatar.jpg");
  if (userId) fd.append("user_id", userId);
  const res = await fetch(userId ? "/api/admin/users/avatar" : "/api/profile/avatar", {
    method: "POST",
    body: fd,
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "Upload failed");
  return d.avatar as string;
}

export default function PhotoPicker({
  prefix,
  disabled,
  onPicked,
  tone = "light",
  layout = "row",
}: {
  prefix: string;
  disabled?: boolean;
  onPicked: (file: File) => void;
  tone?: "light" | "onGradient";
  layout?: "row" | "stack";
}) {
  const { t } = usePrefs();
  const cam = `${prefix}-camera`;
  const gal = `${prefix}-gallery`;

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPicked(file);
  }

  const btn =
    layout === "stack"
      ? "flex min-h-[56px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] bg-white/20 px-2 py-2 text-center text-[11px] font-semibold text-white ring-1 ring-white/30"
      : tone === "onGradient"
        ? "flex min-h-[44px] min-w-0 cursor-pointer flex-wrap items-center justify-center gap-1.5 rounded-[12px] bg-white px-3 py-2 text-center text-[13px] font-semibold leading-snug text-[#172334]"
        : "flex min-h-[40px] min-w-0 cursor-pointer flex-wrap items-center justify-center gap-1 rounded-btn border border-line bg-white px-1.5 py-2 text-center text-[11px] font-semibold leading-snug text-ink";

  return (
    <div className={layout === "stack" ? "grid w-[4.75rem] shrink-0 grid-cols-1 gap-2" : "grid w-full min-w-0 grid-cols-2 gap-2"}>
      <input
        id={cam}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={onChange}
      />
      <input
        id={gal}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={onChange}
      />
      <label htmlFor={cam} className={btn}>
        <Camera className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">{t("takePhoto")}</span>
      </label>
      <label htmlFor={gal} className={btn}>
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">{t("chooseGallery")}</span>
      </label>
    </div>
  );
}
