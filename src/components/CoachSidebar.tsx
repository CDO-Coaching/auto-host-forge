import { Users, User, BookOpen, MessageCircle, HelpCircle, Euro, TrendingUp, StickyNote, CalendarDays, ClipboardList, LayoutDashboard, FlaskConical, Bell, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const ADMIN_EMAIL = "cdo.personaltrainer@gmail.com";

const menuGroups = [
  {
    label: "Coaching",
    items: [
      { title: "Tableau de bord", url: "/coach/dashboard", icon: LayoutDashboard },
      { title: "Mes clients", url: "/coach/mes-clients", icon: Users },
      { title: "Agenda", url: "/coach/agenda", icon: CalendarDays },
      { title: "Séances programmées", url: "/coach/seances-programmees", icon: ClipboardList },
      { title: "Notes", url: "/coach/notes", icon: StickyNote },
      { title: "Messagerie", url: "/coach/messagerie", icon: MessageCircle, showBadge: true },
    ],
  },
  {
    label: "Ressources",
    items: [
      { title: "Bibliothèque d'exercices", url: "/coach/bibliotheque-exercices", icon: BookOpen },
      { title: "Méthodes d'entraînement", url: "/coach/methodologies", icon: BookOpen },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Comptabilité", url: "/coach/comptabilite", icon: Euro },
      { title: "Suivi du salaire", url: "/coach/suivi-salaire", icon: TrendingUp },
      { title: "Notifications", url: "/coach/notifications", icon: Bell },
      { title: "Mon profil", url: "/coach/profil", icon: User },
    ],
  },
];

export function CoachSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();
  const { unreadCount } = useMessages();
  const { user } = useAuth();
  const isAdmin = (user?.email || "").toLowerCase() === ADMIN_EMAIL;

  // Ajoute "Administration" au groupe Admin pour le compte coach principal
  const groups = isAdmin
    ? menuGroups.map((g) =>
        g.label === "Admin"
          ? { ...g, items: [...g.items, { title: "Administration", url: "/coach/admin", icon: ShieldCheck }] }
          : g
      )
    : menuGroups;

  const handleLinkClick = () => {
    // Sur mobile, fermer la sidebar après un clic
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarContent style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs text-muted-foreground/60 uppercase tracking-wider px-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="h-10 sm:h-auto">
                      <NavLink
                        to={item.url}
                        onClick={handleLinkClick}
                        className={({ isActive }) =>
                          isActive ? "bg-primary/10 text-primary font-medium" : ""
                        }
                      >
                        <item.icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="text-sm sm:text-base">{item.title}</span>
                        {item.showBadge && unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto text-xs">
                            {unreadCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
