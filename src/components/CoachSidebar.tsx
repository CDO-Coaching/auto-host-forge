import { Users, User, BookOpen, MessageCircle, HelpCircle, Euro, TrendingUp, StickyNote, CalendarDays, ClipboardList, LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useMessages } from "@/hooks/useMessages";
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

const menuItems = [
  { title: "Tableau de bord", url: "/coach/dashboard", icon: LayoutDashboard },
  { title: "Mes clients", url: "/coach/mes-clients", icon: Users },
  { title: "Agenda", url: "/coach/agenda", icon: CalendarDays },
  { title: "Séances programmées", url: "/coach/seances-programmees", icon: ClipboardList },
  { title: "Notes", url: "/coach/notes", icon: StickyNote },
  { title: "Messagerie", url: "/coach/messagerie", icon: MessageCircle, showBadge: true },
  { title: "Questions", url: "/coach/questions", icon: HelpCircle },
  { title: "Bibliothèque d'exercices", url: "/coach/bibliotheque-exercices", icon: BookOpen },
  { title: "Comptabilité", url: "/coach/comptabilite", icon: Euro },
  { title: "Suivi du salaire", url: "/coach/suivi-salaire", icon: TrendingUp },
  { title: "Mon profil", url: "/coach/profil", icon: User },
];

export function CoachSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();
  const { unreadCount } = useMessages();

  const handleLinkClick = () => {
    // Sur mobile, fermer la sidebar après un clic
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs sm:text-sm">Menu Coach</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
