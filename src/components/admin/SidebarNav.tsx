"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "./AdminLayoutClient";

export default function SidebarNav({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <aside 
      className={`
        border-r border-slate-200 bg-white flex flex-col h-full shadow-xs z-10
        transition-[width] duration-300 ease-in-out motion-reduce:transition-none
        ${isCollapsed ? "w-16" : "w-60"}
      `}
      aria-label="Admin Navigation"
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
        <nav className="space-y-1.5" role="navigation">
          {adminNavItems.map((item) => {
            const isActive = item.href === "/admin" 
              ? pathname === "/admin" 
              : pathname.startsWith(item.href.split("?")[0]);
              
            const Icon = item.icon;

            return (
              <div key={item.name} className="relative group">
                <Link
                  href={item.href}
                  className={`
                    flex items-center rounded-xl transition-all duration-200 cursor-pointer
                    ${isCollapsed ? "justify-center w-12 h-11 mx-auto" : "px-3 py-2.5 gap-3 w-full"}
                    ${isActive 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                    }
                  `}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.name}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon
                    className={`shrink-0 h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700"}`}
                    aria-hidden="true"
                  />
                  {!isCollapsed && <span className="truncate text-sm">{item.name}</span>}
                </Link>

                {isCollapsed && (
                  <div
                    role="tooltip"
                    className="
                      absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 
                      bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl 
                      whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 
                      transition-opacity duration-150
                    "
                  >
                    {item.name}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
