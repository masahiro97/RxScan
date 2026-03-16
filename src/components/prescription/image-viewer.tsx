"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Sun, SunDim } from "lucide-react";

interface ImageViewerProps {
  images: { url: string; pageNumber: number }[];
}

export function ImageViewer({ images }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [pageIdx, setPageIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const image = images[pageIdx];
  if (!image) return null;

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <SunDim className="h-3 w-3 text-gray-400" />
        <input
          type="range" min={50} max={200} value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-20 h-1 accent-blue-400"
        />
        <Sun className="h-3 w-3 text-gray-400" />
        {images.length > 1 && (
          <>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <span className="text-xs text-gray-400">{pageIdx + 1}/{images.length}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300" disabled={pageIdx === 0} onClick={() => setPageIdx(p => p - 1)}>←</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-300" disabled={pageIdx === images.length - 1} onClick={() => setPageIdx(p => p + 1)}>→</Button>
          </>
        )}
        <Button
          size="sm" variant="ghost"
          className="h-6 px-2 text-xs text-gray-300 ml-auto"
          onClick={() => { setZoom(1); setRotation(0); setBrightness(100); }}
        >
          リセット
        </Button>
      </div>

      {/* 画像表示 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        style={{ cursor: "grab" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={`処方箋 p.${image.pageNumber}`}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "top center",
            filter: `brightness(${brightness}%)`,
            maxWidth: "none",
            transition: "transform 0.15s ease",
          }}
          className="shadow-2xl rounded"
          draggable={false}
        />
      </div>
    </div>
  );
}
