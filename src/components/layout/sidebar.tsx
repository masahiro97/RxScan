"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  FileText,
  ScanLine,
  User,
  Pill,
  Store,
  Users,
} from "lucide-react";

const navSections = [
  {
    items: [
      { href: "/", label: "ダッシュボード", icon: Activity },
    ],
  },
  {
    label: "処方箋管理",
    items: [
      { href: "/prescriptions", label: "処方箋一覧", icon: FileText },
      { href: "/prescriptions/upload", label: "新規スキャン", icon: ScanLine },
    ],
  },
  {
    label: "マスタ管理",
    items: [
      { href: "/patients", label: "患者一覧", icon: User },
      { href: "/medicines", label: "薬剤マスタ", icon: Pill },
    ],
  },
  {
    label: "設定",
    items: [
      { href: "/settings/store", label: "店舗設定", icon: Store },
      { href: "/settings/users", label: "ユーザー管理", icon: Users },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-60 bg-white border-r border-neutral-200 flex flex-col h-full shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-500 rounded-md flex items-center justify-center">
            <span className="text-white font-semibold text-xs">Rx</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900 leading-none">RxScan</div>
            <div className="text-xs text-neutral-400 mt-0.5">処方箋OCR登録</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {navSections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 mb-1 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                  >
                    <Icon
                      size={16}
                      className={cn(
                        "shrink-0",
                        active ? "text-primary-600" : "text-neutral-400"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
