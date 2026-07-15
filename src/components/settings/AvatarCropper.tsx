"use client";

// ─── 头像框选裁剪器 ───────────────────────────────
// 用户粘贴图片直链后，可手动拖拽/缩放框选头像范围，
// 确认后导出圆形裁剪的 dataURL 作为头像（避免外链防盗链且可自定义范围）。

import { useCallback, useEffect, useRef, useState } from "react";
import { proxyImageUrl } from "@/lib/image-proxy";
import { RotateCcw, Check, X } from "lucide-react";

const VIEWPORT = 280; // 裁剪视口显示尺寸（CSS px，正方形）
const OUTPUT = 240; // 导出头像像素尺寸（PNG，圆形裁剪）
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

export default function AvatarCropper({
  src,
  onCropped,
  onCancel,
}: {
  src: string;
  onCropped: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const imgSrc = proxyImageUrl(src) ?? src;

  // 图片加载后记录自然尺寸
  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setLoadErr(false);
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  // 计算当前视口下图片的显示尺寸（fit 进视口 × scale）
  const baseSize = useCallback(() => {
    if (!natural) return { w: VIEWPORT, h: VIEWPORT };
    const base = Math.min(VIEWPORT / natural.w, VIEWPORT / natural.h);
    return {
      w: natural.w * base * scale,
      h: natural.h * base * scale,
    };
  }, [natural, scale]);

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const size = baseSize();
    // 视口坐标 → 视口内图片左上角
    const topLeft = {
      x: VIEWPORT / 2 + pos.x - size.w / 2,
      y: VIEWPORT / 2 + pos.y - size.h / 2,
    };
    const ratio = OUTPUT / VIEWPORT;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      img,
      topLeft.x * ratio,
      topLeft.y * ratio,
      size.w * ratio,
      size.h * ratio,
    );
    const dataUrl = canvas.toDataURL("image/png");
    onCropped(dataUrl);
  };

  // 拖拽平移
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setPos({ x: drag.current.px + dx, y: drag.current.py + dy });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // 滚轮缩放（以视口中心为基准）
  useEffect(() => {
    const el = imgRef.current?.parentElement;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = s - e.deltaY * 0.0015;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(next.toFixed(3))));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">框选头像范围</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mb-3">
          拖动图片调整位置，滑块或滚轮缩放，虚线圆内即为最终头像。
        </p>

        <div
          className="relative mx-auto bg-gray-100 rounded-lg overflow-hidden touch-none select-none"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {!loadErr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={imgSrc}
              alt="裁剪源"
              referrerPolicy="no-referrer"
              onLoad={onImgLoad}
              onError={() => setLoadErr(true)}
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{
                width: baseSize().w,
                height: baseSize().h,
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
              }}
            />
          )}
          {loadErr && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-red-500">
              无法加载该图片，请使用图片直链（在图片上右键 → 复制图片地址，形如 images.unsplash.com/...）
            </div>
          )}
          {/* 圆形裁剪框 */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              width: VIEWPORT,
              height: VIEWPORT,
              transform: "translate(-50%, -50%)",
              borderRadius: "9999px",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              border: "2px dashed rgba(255,255,255,0.9)",
            }}
          />
        </div>

        {!loadErr && (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10">缩放</span>
              <input
                type="range"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="flex-1 accent-[#163f3a]"
              />
              <button
                onClick={() => {
                  setScale(1);
                  setPos({ x: 0, y: 0 });
                }}
                className="text-gray-400 hover:text-gray-600"
                title="重置"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleCrop}
            disabled={loadErr}
            className="px-4 py-2 text-sm bg-[#163f3a] hover:bg-[#0f2d2a] text-white rounded-lg disabled:bg-gray-300 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> 使用此头像
          </button>
        </div>
      </div>
    </div>
  );
}
