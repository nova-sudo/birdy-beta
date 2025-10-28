import { LayoutDashboard ,SquareUserRound , Boxes, Phone,List, Settings, Bird  } from "lucide-react"

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

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Menu items.
const items = [
,
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
  }  ,
    {
    title: "Leads",
    url: "/contacts",
    icon: List,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left">
      <SidebarContent className="pt-2 " >
        <SidebarGroup>
            <SidebarMenuButton size="lg" asChild >
              <a href="#">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-md  flex aspect-square size-8 items-center justify-center ">
                    <Bird className="size-6" />
                </div>
                <div className="flex flex-col gap-0.5 text-purple-900 leading-none">
                  <span className="font-bold">Birdy Ai</span>
                  <span className="text-xs ">Alpha 1.0</span>
                </div>
              </a>
            </SidebarMenuButton>
            
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-y-5 pt-4">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                  <TooltipTrigger>
                    <SidebarMenuButton asChild > 
                    <a href={item.url} className="font-semibold text-[14px] text-purple-900  ">
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                    </SidebarMenuButton> 
                    </TooltipTrigger>
                    
                 <TooltipContent>{item.title}</TooltipContent>
                  </Tooltip>
                  </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}