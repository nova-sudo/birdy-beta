import { LayoutDashboard ,SquareUserRound , Boxes, Phone, Settings, Bird  } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Menu items.
const items = [
{
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    url: "/clients",
    icon: SquareUserRound,
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Boxes,
  },
  {
    title: "Call Center",
    url: "/call-center",
    icon: Phone,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="floating" side="left">
      <SidebarContent>
        <SidebarGroup>
            <SidebarMenuButton size="lg" asChild >
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground  flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Bird className="size-6" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold">Birdy Ai</span>
                  <span className="text-xs ">Alpha 1.0</span>
                </div>
              </a>
            </SidebarMenuButton>
            
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>

              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                    
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}