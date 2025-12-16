import { LayoutDashboard, SquareUserRound, Boxes, Phone, List, Calculator, Settings, Bird, LogOut } from "lucide-react"
import { useState } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Menu items.
const items = [
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
    title: "Leads",
    url: "/contacts",
    icon: List,
  },
  {
    title: "Metrics",
    url: "/metrics",
    icon: Calculator,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  } = useSidebar()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    
    try {
      // Call logout API
      const response = await fetch('https://birdy-be.vercel.app/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Clear all localStorage
        localStorage.clear()
        
        // Clear all sessionStorage
        sessionStorage.clear()
        
        // Redirect to landing page
        window.location.href = '/'
      } else {
        console.error('Logout failed:', await response.text())
        // Still redirect even if API fails
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if there's an error
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/'
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <>
    
      <Sidebar
          collapsible="icon"
          variant="sidebar"
          side="left"
          open={isMobile ? openMobile : open}           // 👈 controlled state
          onOpenChange={isMobile ? setOpenMobile : setOpen} // 👈 update state
        >
        <SidebarContent className="pt-2">
          <SidebarGroup>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-md flex aspect-square size-8 items-center justify-center">
                  <Bird className="size-6" />
                </div>
                <div className="flex flex-col gap-0.5 text-purple-900 leading-none">
                  <span className="font-bold">Birdy Ai</span>
                  <span className="text-xs">Alpha 1.0</span>
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
                        <SidebarMenuButton asChild>
                          <a href={item.url} className="font-semibold text-[14px] text-purple-900">
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

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger>
                  <SidebarMenuButton 
                    onClick={() => setShowLogoutDialog(true)}
                    className="font-semibold text-[14px] text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut />
                    <span>Logout</span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent>Logout</TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} >
        <AlertDialogContent className="bg-white ">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be logged out of your account and redirected to the landing page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}