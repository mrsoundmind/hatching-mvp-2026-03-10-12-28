import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X, Search } from "lucide-react";

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  roles: string[];
  color: string;
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
}

const categories = [
  { id: "business", name: "Business + Startups", icon: "🏢", count: 5 },
  { id: "commerce", name: "Brands & Commerce", icon: "🛍️", count: 4 },
  { id: "creative", name: "Creative & Content", icon: "✨", count: 5 },
  { id: "freelance", name: "Freelancers & Solopreneurs", icon: "👤", count: 4 },
  { id: "growth", name: "Growth & Marketing", icon: "📈", count: 4 },
  { id: "internal", name: "Internal Teams & Ops", icon: "⚙️", count: 3 },
  { id: "education", name: "Education & Research", icon: "🎓", count: 3 },
  { id: "personal", name: "Personal & Experimental", icon: "❤️", count: 5 },
  { id: "ideas", name: "Idea Explorer", icon: "💡", count: 9 }
];

const templates: Template[] = [
  {
    id: "saas-startup",
    title: "SaaS Startup",
    description: "Perfect for launching software products and digital platforms",
    category: "business",
    icon: "🚀",
    roles: ["PM Product Manager", "TL Technical Lead", "C Copywriter"],
    color: "blue"
  },
  {
    id: "ai-tool-startup",
    title: "AI Tool Startup",
    description: "Build cutting-edge AI-powered tools and applications",
    category: "business",
    icon: "🤖",
    roles: ["AD AI Developer", "PM Product Manager", "GM Growth Marketer"],
    color: "purple"
  },
  {
    id: "marketplace-app",
    title: "Marketplace App",
    description: "Create platforms that connect buyers and sellers",
    category: "business",
    icon: "🏪",
    roles: ["UD UX Designer", "TL Technical Lead", "OM Operations Manager"],
    color: "green"
  },
  {
    id: "solo-founder-support",
    title: "Solo Founder Support",
    description: "Essential support team for independent entrepreneurs",
    category: "business",
    icon: "👤",
    roles: ["PM Product Manager", "C Copywriter", "OM Operations Manager"],
    color: "amber"
  },
  {
    id: "investor-deck-sprint",
    title: "Investor Deck Sprint",
    description: "Create compelling pitch decks that secure funding",
    category: "business",
    icon: "📊",
    roles: ["PM Product Manager", "BS Brand Strategist", "UD UI Designer"],
    color: "purple"
  }
];

export function TemplateSelectionModal({ isOpen, onClose, onSelectTemplate }: TemplateSelectionModalProps) {
  const [selectedCategory, setSelectedCategory] = useState("business");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = template.category === selectedCategory;
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl bg-[#23262B] border-[#43444B] p-0 h-[80vh]">
        <DialogTitle className="sr-only">Starter template selection</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a starter pack template to create a project with preconfigured hatches.
        </DialogDescription>
        <div className="flex h-full">
          {/* Left sidebar - Categories */}
          <div className="w-64 bg-[#1A1B1E] border-r border-[#43444B] p-4">
            <h3 className="text-[#F1F1F3] font-semibold mb-4">Categories</h3>
            <div className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-[#6C82FF] text-white'
                      : 'text-[#A6A7AB] hover:text-[#F1F1F3] hover:bg-[#37383B]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{category.icon}</span>
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <span className="text-xs bg-[#43444B] px-2 py-1 rounded">
                    {category.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right content - Templates */}
          <div className="flex-1 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[#F1F1F3]">
                  Choose Your Starter Template
                </h2>
                <p className="text-[#A6A7AB] text-sm mt-1">
                  Select a pre-built team to get started quickly, or explore ideas if you're not sure what to build.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A6A7AB]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 bg-[#37383B] border border-[#43444B] rounded-lg text-[#F1F1F3] placeholder-[#A6A7AB] focus:border-[#6C82FF] focus:outline-none"
              />
            </div>

            {/* Templates grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className="p-4 bg-[#37383B] hover:bg-[#43444B] border border-[#43444B] rounded-lg text-left transition-all duration-200 hover:scale-[1.02] group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-2xl">{template.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-[#F1F1F3]">{template.title}</h4>
                        <div className="flex items-center gap-1 text-xs text-[#A6A7AB]">
                          <span>👥</span>
                          <span>{template.roles.length}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[#A6A7AB]">{template.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    {template.roles.map((role, index) => (
                      <div key={index} className="text-xs text-[#A6A7AB]">
                        {role}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-center w-full py-2 bg-[#6C82FF] hover:bg-[#5A6FE8] text-white rounded-lg text-sm font-medium transition-colors group-hover:scale-105">
                    Use Pack
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
