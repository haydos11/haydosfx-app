import * as React from "react";
import SidebarNav from "@/components/nav/SidebarNav";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "full";

function containerClass(size: ContainerSize = "lg") {
  switch (size) {
    case "sm": return "max-w-3xl";
    case "md": return "max-w-5xl";
    case "lg": return "max-w-6xl";
    case "xl": return "max-w-7xl";
    case "full": return "max-w-none";
  }
}

export default function AppShell({
  children,
  title,
  subtitle,
  right,
  stickyHeader = false,
  container = "lg",
  fullBleed = false,
  className = "",
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  stickyHeader?: boolean;
  container?: ContainerSize;
  fullBleed?: boolean;
  className?: string;
}) {
  return (
    // 🔧 removed `${className}` from the ROOT so it never affects the sidebar
    <div className="flex min-h-screen bg-[#0a0a0a] text-slate-100">
      {/* Sidebar */}
      <aside
        className="
          flex-none shrink-0
          w-48 md:w-52 lg:w-56 xl:w-60
          [&>*]:w-full [&_*]:max-w-full overflow-hidden
          border-r border-white/10 bg-[#0b0b0b]
        "
      >
        <SidebarNav />
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0">
        {(title || subtitle || right) && (
          <header
            className={[
              stickyHeader ? "sticky top-0 z-20" : "",
              "border-b border-white/10 bg-[#0b0b0b]/80 backdrop-blur",
            ].join(" ")}
          >
            <div className={`mx-auto ${containerClass(container)} px-8 py-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {title ? (
                    <h1 className="truncate text-xl font-semibold sm:text-2xl">
                      {title}
                    </h1>
                  ) : null}
                  {subtitle ? (
                    <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
                  ) : null}
                </div>
                {right ? <div className="shrink-0">{right}</div> : null}
              </div>
            </div>
          </header>
        )}

        {/* Page body */}
        <main className="min-w-0">
          {fullBleed ? (
            // 🔧 apply className here (content area only)
            <div className={`w-full ${className}`}>
              <div className="px-4 sm:px-6 lg:px-8 py-10 overflow-x-auto">
                {children}
              </div>
            </div>
          ) : (
            // 🔧 and here for the constrained container path
            <div className={`mx-auto ${containerClass(container)} px-8 py-10 ${className}`}>
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
