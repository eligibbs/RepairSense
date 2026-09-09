"use client";

import { Gauge, Laptop, Truck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", icon: Gauge, label: "Dashboard" },
  { href: "/devices", icon: Laptop, label: "Devices" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/deliveries", icon: Truck, label: "Deliveries" },
];

export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label={mobile ? "Mobile primary" : "Primary"} className={mobile ? "flex gap-1 overflow-x-auto" : "space-y-0.5"}>
      {links.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex h-control-sm items-center gap-2 rounded-md px-2 font-medium ${mobile ? "shrink-0 text-xs" : "w-full text-sm"} ${active ? "bg-primary-soft text-primary" : "text-muted hover:bg-zinc-100 hover:text-foreground"}`}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
