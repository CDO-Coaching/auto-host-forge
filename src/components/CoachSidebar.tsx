import { Calendar, Users, User, BookOpen, MessageCircle } from "lucide-react";
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
  { title: "Programmation", url: "/coach/programmation", icon: Calendar },
  { title: "Mes clients", url: "/coach/mes-clients", icon: Users },
  { title: "Messagerie", url: "/coach/messagerie", icon: MessageCircle, showBadge: true },
  { title: "Bibliothèque d'exercices", url: "/coach/bibliotheque-exercices", icon: BookOpen },
  { title: "Mon profil", url: "/coach/profil", icon: User },
];

export function CoachSidebar() {
  const { open } = useSidebar();
  const { unreadCount } = useMessages();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Coach</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      className={({ isActive }) => 
                        isActive ? "bg-primary/10 text-primary font-medium" : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                      {item.showBadge && unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto">
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
