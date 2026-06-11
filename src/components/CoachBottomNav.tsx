import { LayoutDashboard, Users, CalendarDays, MessageCircle, Euro, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useMessages } from "@/hooks/useMessages";
import { Badge } from "@/components/ui/badge";

const items = [
  { to: "/coach/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/coach/mes-clients", label: "Clients", icon: Users },
  { to: "/coach/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/coach/messagerie", label: "Messages", icon: MessageCircle, showBadge: true },
  { to: "/coach/comptabilite", label: "Compta", icon: Euro },
];

/**
 * Bottom navigation mobile « style app native ».
 * Visible uniquement sur mobile (sm:hidden). Le menu burger (Menu) ouvre la sidebar
 * existante pour accéder aux pages secondaires.
 */
export function CoachBottomNav() {
  const { toggleSidebar } = useSidebar();
  const { unreadCount } = useMessages();

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <div className="flex h-20">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center justify-center gap-1 relative touch-manipulation select-none ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">{item.label}</span>
            {item.showBadge && unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute top-2 right-1/2 translate-x-3 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 text-muted-foreground touch-manipulation select-none"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">Menu</span>
        </button>
      </div>
    </nav>
  );
}
