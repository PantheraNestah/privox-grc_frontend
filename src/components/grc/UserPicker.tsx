// Searchable user picker — uses the app's user directory.
// Stores the selected user's NAME (string) so the existing `owner: string` model still works.

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { loadUsers, ROLE_LABELS, type AppUser } from "@/data/userStore";

interface Props {
  value?: string;                       // current owner name
  onChange: (name: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  allowFreeText?: boolean;              // keep the typed string even if no match
}

export const UserPicker = ({
  value, onChange, placeholder = "Select owner...", className, size = "md", allowFreeText = true,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const users = useMemo<AppUser[]>(() => loadUsers(), []);

  const heightClass = size === "sm" ? "h-8 text-xs" : "h-10 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", heightClass, className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            <UserIcon className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5 text-muted-foreground" />
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search users by name, email or role..."
            value={query}
            onValueChange={setQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {allowFreeText && query.trim() ? (
                <button
                  type="button"
                  className="w-full text-left text-xs px-3 py-2 hover:bg-accent rounded-sm"
                  onClick={() => { onChange(query.trim()); setOpen(false); setQuery(""); }}
                >
                  Use "<strong>{query.trim()}</strong>" as owner name
                </button>
              ) : (
                <span className="text-xs text-muted-foreground px-3 py-2 block">No users found.</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {users.map(u => (
                <CommandItem
                  key={u.id}
                  value={`${u.name} ${u.email} ${ROLE_LABELS[u.role]}`}
                  onSelect={() => { onChange(u.name); setOpen(false); setQuery(""); }}
                  className="text-xs"
                >
                  <Check
                    className={cn("mr-2 h-3.5 w-3.5", value === u.name ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {ROLE_LABELS[u.role]}{u.title ? ` · ${u.title}` : ""}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
