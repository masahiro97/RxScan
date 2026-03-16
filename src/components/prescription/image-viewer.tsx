"use client";

import { useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Sun, SunDim } from "lucide-react";
import type { TextBlock } from "@/server/services/ocr/types";

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
  const [pdfPage, setPdfPage] = useState(1);       // PDF内ページ (1-indexed)
  const [imgIdx, setImgIdx] = useState(0);         // 画像ファイルインデックス
  const [numPages, setNumPages] = useState(0);
  const [pageRendered, setPageRendered] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // PDFは常に images[0] のURLを使い、pdfPage で内部ページ番号を管理
  const firstImage = images[0];
  if (!firstImage) return null;

  const isPdf = firstImage.mimeType === "application/pdf";
  const currentPage = isPdf ? pdfPage : imgIdx + 1;

  // ハイライト（% ポジショニングなので pageWidth 不要）
  const highlights = textBlocks.filter((b) => b.page === currentPage);

  const pageStyle = {
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: "top center" as const,
    filter: `brightness(${brightness}%)`,
    display: "inline-block" as const,
    position: "relative" as const,
  };

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
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

        {/* PDF ページ送り */}
        {isPdf && numPages > 1 && (
          <>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
              disabled={pdfPage <= 1 || !pageRendered}
              onClick={() => { setPageRendered(false); setPdfPage((p) => p - 1); }}>←</Button>
            <span className="text-xs text-gray-400">{pdfPage}/{numPages}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
              disabled={pdfPage >= numPages || !pageRendered}
              onClick={() => { setPageRendered(false); setPdfPage((p) => p + 1); }}>→</Button>
          </>
        )}

        {/* 画像ファイル送り */}
        {!isPdf && images.length > 1 && (
          <>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
              disabled={imgIdx === 0} onClick={() => setImgIdx((i) => i - 1)}>←</Button>
            <span className="text-xs text-gray-400">{imgIdx + 1}/{images.length}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300"
              disabled={imgIdx === images.length - 1} onClick={() => setImgIdx((i) => i + 1)}>→</Button>
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

      {/* 表示エリア */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4 bg-gray-900"
      >
        {isPdf ? (
          <Document
            file={firstImage.url}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPageRendered(true); }}
            loading={<div className="text-gray-400 text-sm mt-10">PDF読み込み中...</div>}
            error={<div className="text-red-400 text-sm mt-10">PDF の読み込みに失敗しました</div>}
          >
            <div style={pageStyle} className="shadow-2xl">
              {/* ページ切替中はスケルトン表示して黒画面を防ぐ */}
              {!pageRendered && (
                <div
                  className="absolute inset-0 z-10 bg-gray-200 animate-pulse"
                  style={{ width: Math.round(600 * zoom), minHeight: 800 }}
                />
              )}
              <Page
                key={pdfPage}
                pageNumber={pdfPage}
                width={Math.round(600 * zoom)}
                renderAnnotationLayer
                renderTextLayer
                onRenderSuccess={() => setPageRendered(true)}
                loading=""
              />
              {/* OCR ハイライト（% 座標、pageWidth 不要） */}
              {highlights.map((b, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                    background: "rgba(250, 204, 21, 0.22)",
                    border: "1px solid rgba(250, 204, 21, 0.55)",
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          </Document>
        ) : (
          // 画像（JPEG/PNG/TIFF）
          <div style={pageStyle} className="shadow-2xl rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[imgIdx]!.url}
              alt={`処方箋 p.${images[imgIdx]!.pageNumber}`}
              className="max-w-none rounded"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease",
              }}
              draggable={false}
            />
            {highlights.map((b, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.w * 100}%`,
                  height: `${b.h * 100}%`,
                  background: "rgba(250, 204, 21, 0.22)",
                  border: "1px solid rgba(250, 204, 21, 0.55)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
