import { useState } from "react";
import { LayoutDashboard, Layers, Settings, FileText, BarChart3, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default

  const navigation = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: LayoutDashboard,
      description: "Overview & Analytics"
    },
    {
      id: "workflows",
      name: "Workflows",
      icon: Layers,
      description: "Create & Execute Workflows"
    },
    {
      id: "templates",
      name: "Templates",
      icon: FileText,
      description: "Pre-built Workflows"
    },
    {
      id: "analytics",
      name: "Analytics",
      icon: BarChart3,
      description: "Performance Insights"
    },
    {
      id: "settings",
      name: "Settings",
      icon: Settings,
      description: "Configuration"
    }
  ];

  return (
    <div className={cn(
      "bg-gradient-secondary border-r border-border flex flex-col transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className={cn("border-b border-border", isCollapsed ? "p-4" : "p-6")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-lg">BatchFlow</h1>
              <p className="text-xs text-muted-foreground">Automation Platform</p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <div className="p-2">
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="ghost"
          size="sm"
          className="w-full"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center h-10 p-2" : "justify-start gap-3 h-auto p-3",
              activeTab === item.id
                ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                : "hover:bg-accent text-foreground"
            )}
            onClick={() => onTabChange(item.id)}
            title={isCollapsed ? item.name : undefined}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && (
              <div className="text-left">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs opacity-70">{item.description}</div>
              </div>
            )}
          </Button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        {!isCollapsed && (
          <>
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
            
            {/* System Status */}
            <div className="bg-accent rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">System Status</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All services operational
              </p>
            </div>
          </>
        )}
        {isCollapsed && (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;