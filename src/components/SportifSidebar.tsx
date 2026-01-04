import { Calendar, Activity, User, TrendingUp, Scale, ListChecks, HelpCircle, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
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
  { title: "Aide", url: "/sportif/aide", icon: HelpCircle },
  { title: "Politique RGPD", url: "/politique-rgpd", icon: Shield },
];

export function SportifSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();

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
