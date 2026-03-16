"use client";

import { useState, useRef } from "react";
import { useController } from "react-hook-form";
import type { Control } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Pill, Check } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface MedicineSuggestProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  nameField: string;
  medicineIdField: string;
  disabled?: boolean;
}

export function MedicineSuggest({ control, nameField, medicineIdField, disabled }: MedicineSuggestProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { field: nameField_ } = useController({ control, name: nameField });
  const { field: idField } = useController({ control, name: medicineIdField });

  const { data: suggestions } = trpc.medicine.suggest.useQuery(
    { rawName: debouncedQuery, limit: 5 },
    { enabled: debouncedQuery.length >= 2 }
  );

  const handleSelect = (candidate: { id: string; name: string }) => {
    nameField_.onChange(candidate.name);
    idField.onChange(candidate.id);
    setQuery(candidate.name);
    setOpen(false);
  };

  const handleInput = (val: string) => {
    setQuery(val);
    nameField_.onChange(val);
    idField.onChange(undefined);
    setOpen(true);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <Label className="text-xs">薬剤名</Label>
      <div className="relative">
        <Input
          value={(nameField_.value as string) ?? ""}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          disabled={disabled}
          placeholder="薬剤名を入力..."
          className={cn(idField.value ? "border-green-400" : "")}
        />
        {idField.value && (
          <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-green-500" />
        )}

        {/* サジェストドロップダウン */}
        {open && suggestions && suggestions.length > 0 && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg">
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-start gap-2"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
              >
                <Pill className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.genericName && c.genericName !== c.name && (
                    <div className="text-gray-400">{c.genericName}</div>
                  )}
                  <div className="text-gray-300">{c.yjCode} {c.manufacturer}</div>
                </div>
                <div className="ml-auto text-blue-400 font-medium">
                  {Math.round(c.similarity * 100)}%
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
