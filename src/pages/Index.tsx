import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import Templates from "@/components/Templates";
import FlowBatchBuilder from "@/components/FlowBatchBuilder";
import UserIndicator from "@/components/auth/UserIndicator";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "workflows":
        return <FlowBatchBuilder />;
      case "templates":
        return <Templates />;
      case "analytics":
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Analytics</h2>
            <p className="text-muted-foreground">Advanced analytics coming soon...</p>
          </div>
        );
      case "settings":
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <p className="text-muted-foreground">Configuration options coming soon...</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {/* Header with user indicator */}
        <div className="border-b bg-card p-4 flex justify-end">
          <UserIndicator />
        </div>
        
        {activeTab === "workflows" ? (
          <FlowBatchBuilder />
        ) : (
          <main className="p-8">
            {renderContent()}
          </main>
        )}
      </div>
    </div>
  );
};

export default Index;
