"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Samo ovaj deo sidebar-a je klijentski — `usePathname` je jedina stvar koja
 * trazi klijent, pa ostatak `AdminSidebar`-a ostaje serverska komponenta.
 */
const ITEMS = [
  { href: "/admin", label: "Snimci", exact: true },
  { href: "/admin/videos/new", label: "Novi snimak", exact: false },
] as const;

const BASE =
  "kf-focus-ring rounded-kf-btn border px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 md:flex-col">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${BASE} ${
              active
                ? "border-kf-line-strong bg-kf-fill text-kf-ink"
                : "text-kf-mut hover:bg-kf-fill hover:text-kf-ink border-transparent"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
