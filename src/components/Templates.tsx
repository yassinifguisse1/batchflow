import { useState } from "react";
import { FileText, Copy, Play, Star, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const Templates = () => {
  const { toast } = useToast();

  const templates = [
    {
      id: "article-automation",
      name: "Article Automation",
      description: "Complete article generation workflow with SEO optimization, image processing, and content analysis.",
      tasks: [
        { type: "gpt", description: "Generate article outline" },
        { type: "gpt", description: "Write article content" },
        { type: "gpt", description: "Create SEO meta description" },
        { type: "image", description: "Generate featured image" },
        { type: "http", description: "Publish to CMS" }
      ],
      category: "Content Creation",
      popularity: 95,
      estimatedTime: "45-60s",
      rating: 4.8,
      uses: 1247
    },
    {
      id: "social-media-batch",
      name: "Social Media Batch",
      description: "Generate social media posts across multiple platforms with hashtag optimization and image creation.",
      tasks: [
        { type: "gpt", description: "Create Twitter post" },
        { type: "gpt", description: "Create LinkedIn post" },
        { type: "gpt", description: "Generate hashtags" },
        { type: "image", description: "Create social media graphics" },
        { type: "http", description: "Schedule posts" }
      ],
      category: "Marketing",
      popularity: 87,
      estimatedTime: "30-45s",
      rating: 4.6,
      uses: 892
    },
    {
      id: "product-analysis",
      name: "Product Analysis",
      description: "Comprehensive product research including competitor analysis, market trends, and feature extraction.",
      tasks: [
        { type: "http", description: "Fetch product data" },
        { type: "gpt", description: "Analyze competitors" },
        { type: "gpt", description: "Extract key features" },
        { type: "gpt", description: "Generate market report" },
        { type: "image", description: "Create analysis charts" }
      ],
      category: "Research",
      popularity: 78,
      estimatedTime: "60-90s",
      rating: 4.7,
      uses: 654
    },
    {
      id: "email-campaign",
      name: "Email Campaign",
      description: "Automated email sequence generation with personalization, A/B testing variants, and performance tracking.",
      tasks: [
        { type: "gpt", description: "Generate email subject lines" },
        { type: "gpt", description: "Create email content" },
        { type: "gpt", description: "Personalization variants" },
        { type: "image", description: "Email banner design" },
        { type: "http", description: "Send to email service" }
      ],
      category: "Marketing",
      popularity: 82,
      estimatedTime: "40-55s",
      rating: 4.5,
      uses: 743
    },
    {
      id: "data-processing",
      name: "Data Processing Pipeline",
      description: "Clean, analyze, and visualize data from multiple sources with automated reporting and insights.",
      tasks: [
        { type: "http", description: "Fetch raw data" },
        { type: "gpt", description: "Clean and normalize" },
        { type: "gpt", description: "Generate insights" },
        { type: "image", description: "Create visualizations" },
        { type: "http", description: "Save to database" }
      ],
      category: "Analytics",
      popularity: 71,
      estimatedTime: "75-120s",
      rating: 4.9,
      uses: 456
    },
    {
      id: "content-optimization",
      name: "Content Optimization",
      description: "Optimize existing content for SEO, readability, and engagement with automated improvements.",
      tasks: [
        { type: "gpt", description: "Analyze content quality" },
        { type: "gpt", description: "Improve readability" },
        { type: "gpt", description: "Optimize for SEO" },
        { type: "image", description: "Update images" },
        { type: "http", description: "Update CMS" }
      ],
      category: "Content Creation",
      popularity: 79,
      estimatedTime: "35-50s",
      rating: 4.4,
      uses: 598
    }
  ];

  const categories = ["All", "Content Creation", "Marketing", "Research", "Analytics"];
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredTemplates = selectedCategory === "All" 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const useTemplate = (template: any) => {
    toast({
      title: "Template loaded",
      description: `${template.name} has been loaded into the batch builder.`
    });
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'gpt':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'image':
        return 'bg-success/20 text-success border-success/30';
      case 'http':
        return 'bg-warning/20 text-warning border-warning/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Workflow Templates
        </h2>
        <p className="text-muted-foreground mt-2">
          Pre-built batch workflows for common automation tasks
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            onClick={() => setSelectedCategory(category)}
            className={selectedCategory === category ? "bg-gradient-primary" : ""}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="bg-gradient-accent border-border shadow-card hover:shadow-elegant transition-all duration-300 group">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                  <Badge variant="secondary" className="mb-3">
                    {template.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-warning">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-sm font-medium">{template.rating}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {template.description}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tasks */}
              <div>
                <h4 className="text-sm font-medium mb-2">Tasks ({template.tasks.length})</h4>
                <div className="space-y-2">
                  {template.tasks.slice(0, 3).map((task, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <Badge className={`px-2 py-1 text-xs border ${getTaskTypeColor(task.type)}`}>
                        {task.type.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground truncate">{task.description}</span>
                    </div>
                  ))}
                  {template.tasks.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{template.tasks.length - 3} more tasks
                    </p>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {template.estimatedTime}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {template.uses} uses
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => useTemplate(template)}
                  className="flex-1 gap-2 bg-gradient-primary hover:opacity-90"
                >
                  <Play className="h-4 w-4" />
                  Use Template
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Clone
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Templates;