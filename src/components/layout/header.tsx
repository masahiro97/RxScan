"use client";

import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { data: session } = useSession();
  const { data: store } = trpc.store.getCurrent.useQuery();
  const router = useRouter();

  return (
    <header className="h-14 bg-primary-500 text-white flex items-center justify-between px-5 shadow-sm shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-md flex items-center justify-center">
            <span className="text-white font-semibold text-xs">Rx</span>
          </div>
          <span className="font-semibold text-base tracking-tight">RxScan</span>
        </div>
        {title && (
          <>
            <span className="text-white/40 text-sm">/</span>
            <h1 className="text-sm font-medium text-white/90">{title}</h1>
          </>
        )}
      </div>

      {session?.user && (
        <div className="flex items-center gap-4">
          {store && (
            <span className="text-sm text-white/70 hidden sm:block">{store.name}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 text-sm text-white/90 hover:text-white transition-colors focus-visible:outline-none">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                <User size={14} />
              </div>
              <span className="hidden sm:block">{session.user.name}</span>
              <span className="hidden sm:block text-xs text-white/60">
                ({ROLE_LABELS[session.user.role] ?? session.user.role})
              </span>
              <ChevronDown size={14} className="text-white/60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => router.push("/settings/store")}
              >
                <Settings size={14} />
                店舗設定
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger-600 focus:text-danger-600 flex items-center gap-2 cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut size={14} />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
