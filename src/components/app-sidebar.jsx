import { SquareUserRound, ChartNoAxesColumnIncreasing, Bell, Phone, List, Calculator, Settings, Bird, LogOut, Sparkles } from "lucide-react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSidebar } from "@/components/ui/sidebar"
import { apiRequest } from "@/lib/api"
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

const items = [
  { title: "Clients", url: "/clients", icon: SquareUserRound },
  { title: "Ask Birdy", url: "/ask-birdy", icon: Sparkles },
  { title: "Marketing", url: "/campaigns", icon: ChartNoAxesColumnIncreasing },
  { title: "Sales", url: "/Sales-Hub", icon: Phone },
  { title: "Leads", url: "/contacts", icon: List },
  { title: "Metrics", url: "/metrics", icon: Calculator },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const {
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
  } = useSidebar()

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await apiRequest("/api/logout", { method: "POST" })
    } catch {
      // Logout even if API call fails
    } finally {
      localStorage.clear()
      sessionStorage.clear()
      setIsLoggingOut(false)
      window.location.href = "/"
    }
  }

  return (
    <>
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        side="left"
        open={isMobile ? openMobile : open}
        onOpenChange={isMobile ? setOpenMobile : setOpen}
      >
        <SidebarContent className="pt-2">
          <SidebarGroup>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/clients">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-md flex aspect-square size-8 items-center justify-center">
                  <Bird className="size-6" />
                </div>
                <div className="flex flex-col gap-0.5 text-purple-900 leading-none">
                  <span className="font-bold">Birdy Ai</span>
                  <span className="text-xs">Alpha 1.0</span>
                </div>
              </Link>
            </SidebarMenuButton>

            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-y-5 pt-4">
                {items.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger>
                          <SidebarMenuButton asChild>
                            <Link
                              href={item.url}
                              className={`font-semibold text-[14px] ${isActive ? 'text-purple-600' : 'text-black'}`}
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent>{item.title}</TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
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

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-white">
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
