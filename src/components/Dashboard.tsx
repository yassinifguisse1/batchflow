import { Activity, Zap, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const stats = [
    {
      title: "Total Batches",
      value: "1,247",
      change: "+12.5%",
      icon: Activity,
      color: "text-primary"
    },
    {
      title: "Success Rate",
      value: "94.2%",
      change: "+2.1%",
      icon: CheckCircle,
      color: "text-success"
    },
    {
      title: "Avg. Execution Time",
      value: "2.4s",
      change: "-15%",
      icon: Clock,
      color: "text-warning"
    },
    {
      title: "Tasks/Minute",
      value: "156",
      change: "+8.3%",
      icon: Zap,
      color: "text-primary-glow"
    }
  ];

  const recentBatches = [
    {
      id: "batch_001",
      status: "success",
      tasks: 12,
      duration: "2.1s",
      timestamp: "2 minutes ago",
      type: "Article Generation"
    },
    {
      id: "batch_002",
      status: "failed",
      tasks: 8,
      duration: "1.8s",
      timestamp: "5 minutes ago",
      type: "Image Processing"
    },
    {
      id: "batch_003",
      status: "success",
      tasks: 15,
      duration: "3.2s",
      timestamp: "8 minutes ago",
      type: "Content Analysis"
    },
    {
      id: "batch_004",
      status: "success",
      tasks: 6,
      duration: "1.2s",
      timestamp: "12 minutes ago",
      type: "SEO Optimization"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-success text-success-foreground">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Dashboard
        </h2>
        <p className="text-muted-foreground mt-2">
          Monitor your batch automation performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-gradient-accent border-border shadow-card hover:shadow-elegant transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-success">
                    {stat.change} from last week
                  </p>
                </div>
                <div className={`p-3 bg-primary/10 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Batches */}
        <Card className="bg-gradient-secondary border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Batches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBatches.map((batch, index) => (
                <div key={batch.id} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(batch.status)}
                    <div>
                      <p className="font-medium">{batch.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {batch.tasks} tasks • {batch.duration}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(batch.status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {batch.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card className="bg-gradient-secondary border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">API Response Time</span>
                  <span className="text-sm text-success">Excellent</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-success h-2 rounded-full" style={{ width: '94%' }}></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">94% faster than average</p>
              </div>

              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Error Rate</span>
                  <span className="text-sm text-warning">Good</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-warning h-2 rounded-full" style={{ width: '6%' }}></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">5.8% of requests failed</p>
              </div>

              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Throughput</span>
                  <span className="text-sm text-primary-glow">High</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '87%' }}></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">156 tasks per minute</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;