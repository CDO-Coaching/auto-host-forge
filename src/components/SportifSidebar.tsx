import { Calendar, LayoutDashboard, Target, LineChart, UserCog } from "lucide-react";
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

const baseMenuItems = [
  { title: "Tableau de bord", url: "/sportif/dashboard", icon: LayoutDashboard },
  { title: "Mes séances", url: "/sportif/seances", icon: Calendar },
  { title: "Mes objectifs", url: "/sportif/objectifs", icon: Target },
  { title: "Mon suivi", url: "/sportif/suivi", icon: LineChart },
  { title: "Mon compte", url: "/sportif/compte", icon: UserCog },
];

export function SportifSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const menuItems = baseMenuItems;

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="floating"
      className="border-r-0 [&_[data-sidebar=sidebar]]:!h-auto [&_[data-sidebar=sidebar]]:!max-h-[calc(100svh-1rem)] [&_[data-sidebar=sidebar]]:rounded-2xl [&_[data-sidebar=sidebar]]:border [&_[data-sidebar=sidebar]]:border-border/60 [&_[data-sidebar=sidebar]]:shadow-2xl [&_[data-sidebar=sidebar]]:overflow-hidden"
    >
      <SidebarContent
        className="!h-auto"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
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
