import { Calendar, Activity, User, TrendingUp, Scale, ListChecks, Download } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
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
  { title: "Mes séances", url: "/sportif/seances", icon: Calendar },
  { title: "Mon agenda", url: "/sportif/agenda", icon: ListChecks },
  { title: "Mon suivi fatigue", url: "/sportif/fatigue", icon: Activity },
  { title: "Mes max", url: "/sportif/maxes", icon: TrendingUp },
  { title: "Mon poids", url: "/sportif/poids", icon: Scale },
  { title: "Mon profil", url: "/sportif/profil", icon: User },
  { title: "Installer", url: "/sportif/installer", icon: Download },
];

export function SportifSidebar() {
  const { open, setOpen } = useSidebar();
  const isMobile = useIsMobile();

  const handleLinkClick = () => {
    // Sur mobile, fermer la sidebar après un clic
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs sm:text-sm">Menu Sportif</SidebarGroupLabel>
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
