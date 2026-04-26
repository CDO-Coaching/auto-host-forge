import { LayoutDashboard, Users, CalendarDays, MessageCircle, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useMessages } from "@/hooks/useMessages";
import { Badge } from "@/components/ui/badge";

const items = [
  { to: "/coach/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/coach/mes-clients", label: "Clients", icon: Users },
  { to: "/coach/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/coach/messagerie", label: "Messages", icon: MessageCircle, showBadge: true },
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
      <div className="grid grid-cols-5 h-16">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 app-tap relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
            {item.showBadge && unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute top-1 right-1/2 translate-x-3 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground app-tap"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
