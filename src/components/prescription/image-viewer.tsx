"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Sun, SunDim } from "lucide-react";
import type { TextBlock } from "@/server/services/ocr/types";

// pdf.js worker（Next.js static assets から配信）
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface ImageViewerProps {
  images: { url: string; pageNumber: number; mimeType?: string }[];
  textBlocks?: TextBlock[];
}

export function ImageViewer({ images, textBlocks = [] }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [pageIdx, setPageIdx] = useState(0);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const image = images[pageIdx];
  const isPdf = image?.mimeType === "application/pdf";
  const currentPage = pageIdx + 1;

  // ページのレンダリングサイズを取得（ハイライト座標計算用）
  useEffect(() => {
    if (!pageRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const el = entries[0]?.contentRect;
      if (el) { setPageWidth(el.width); setPageHeight(el.height); }
    });
    obs.observe(pageRef.current);
    return () => obs.disconnect();
  }, [pageIdx, zoom]);

  if (!image) return null;

  // 現在ページのハイライト
  const highlights = textBlocks.filter((b) => b.page === currentPage);

  const toolbar = (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
        onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
        onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <div className="w-px h-4 bg-gray-600 mx-1" />
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
        onClick={() => setRotation((r) => (r + 90) % 360)}>
        <RotateCw className="h-4 w-4" />
      </Button>
      <div className="w-px h-4 bg-gray-600 mx-1" />
      <SunDim className="h-3 w-3 text-gray-400" />
      <input type="range" min={50} max={200} value={brightness}
        onChange={(e) => setBrightness(Number(e.target.value))}
        className="w-20 h-1 accent-blue-400" />
      <Sun className="h-3 w-3 text-gray-400" />
      {isPdf && numPages > 1 && (
        <>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
            disabled={pageIdx === 0} onClick={() => setPageIdx((p) => p - 1)}>←</Button>
          <span className="text-xs text-gray-400">{currentPage}/{numPages}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
            disabled={pageIdx === numPages - 1} onClick={() => setPageIdx((p) => p + 1)}>→</Button>
        </>
      )}
      {!isPdf && images.length > 1 && (
        <>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <span className="text-xs text-gray-400">{pageIdx + 1}/{images.length}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
            disabled={pageIdx === 0} onClick={() => setPageIdx((p) => p - 1)}>←</Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
            disabled={pageIdx === images.length - 1} onClick={() => setPageIdx((p) => p + 1)}>→</Button>
        </>
      )}
      {highlights.length > 0 && (
        <span className="text-xs text-yellow-400 ml-1">{highlights.length}箇所認識</span>
      )}
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300 ml-auto"
        onClick={() => { setZoom(1); setRotation(0); setBrightness(100); }}>
        リセット
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {toolbar}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
      >
        {isPdf ? (
          <Document
            file={image.url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<span className="text-gray-400 text-sm mt-10">読み込み中...</span>}
            error={<span className="text-red-400 text-sm mt-10">PDF の読み込みに失敗しました</span>}
          >
            <div
              ref={pageRef}
              className="relative shadow-2xl"
              style={{
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                transformOrigin: "top center",
                filter: `brightness(${brightness}%)`,
                display: "inline-block",
              }}
            >
              <Page
                pageNumber={currentPage}
                width={Math.round(600 * zoom)}
                renderAnnotationLayer
                renderTextLayer
              />
              {/* OCR ハイライトオーバーレイ */}
              {pageWidth > 0 && highlights.map((b, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                    background: "rgba(250, 204, 21, 0.25)",
                    border: "1px solid rgba(250, 204, 21, 0.5)",
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          </Document>
        ) : (
          // 画像（JPEG/PNG/TIFF）
          <div
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "top center",
              filter: `brightness(${brightness}%)`,
              transition: "transform 0.15s ease",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={`処方箋 p.${image.pageNumber}`}
              className="shadow-2xl rounded max-w-none"
              draggable={false}
            />
            {/* 画像の場合もハイライトを表示 */}
            {highlights.length > 0 && (
              <div className="relative" style={{ position: "absolute", inset: 0 }}>
                {highlights.map((b, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.w * 100}%`,
                      height: `${b.h * 100}%`,
                      background: "rgba(250, 204, 21, 0.25)",
                      border: "1px solid rgba(250, 204, 21, 0.5)",
                      borderRadius: 2,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
