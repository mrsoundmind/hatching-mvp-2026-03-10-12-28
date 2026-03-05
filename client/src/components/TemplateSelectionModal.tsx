import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  X,
  Search,
  Briefcase,
  ShoppingBag,
  Sparkles,
  User,
  TrendingUp,
  Settings,
  GraduationCap,
  Heart,
  Lightbulb,
} from "lucide-react";
import { motion } from "framer-motion";

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
  { id: "business", name: "Business + Startups", icon: "briefcase", count: 5 },
  { id: "commerce", name: "Brands & Commerce", icon: "shopping", count: 4 },
  { id: "creative", name: "Creative & Content", icon: "sparkles", count: 5 },
  { id: "freelance", name: "Freelancers & Solopreneurs", icon: "user", count: 4 },
  { id: "growth", name: "Growth & Marketing", icon: "growth", count: 4 },
  { id: "internal", name: "Internal Teams & Ops", icon: "settings", count: 3 },
  { id: "education", name: "Education & Research", icon: "education", count: 3 },
  { id: "personal", name: "Personal & Experimental", icon: "heart", count: 5 },
  { id: "ideas", name: "Idea Explorer", icon: "ideas", count: 9 }
];

const categoryIconMap = {
  briefcase: Briefcase,
  shopping: ShoppingBag,
  sparkles: Sparkles,
  user: User,
  growth: TrendingUp,
  settings: Settings,
  education: GraduationCap,
  heart: Heart,
  ideas: Lightbulb,
} as const;

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
      <DialogContent className="max-w-6xl bg-[#1D2027] border-[#3A3E47] p-0 h-[80vh]">
        <DialogTitle className="sr-only">Starter template selection</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a starter pack template to create a project with preconfigured hatches.
        </DialogDescription>
        <div className="flex h-full">
          {/* Left sidebar - Categories */}
          <div className="w-72 bg-[#171A20] border-r border-[#343844] p-5">
            <h3 className="text-[#F1F1F3] font-semibold mb-4 tracking-wide">Categories</h3>
            <div className="space-y-1">
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  whileHover={{ x: 2 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-[#6C82FF] to-[#5C72F5] text-white'
                      : 'text-[#A6A7AB] hover:text-[#F1F1F3] hover:bg-[#2B2F39]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = categoryIconMap[category.icon as keyof typeof categoryIconMap];
                      return (
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center ${selectedCategory === category.id ? 'bg-white/15' : 'bg-[#242833]'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                      );
                    })()}
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <span className="text-xs bg-[#43444B]/70 px-2 py-1 rounded-md">
                    {category.count}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Right content - Templates */}
          <div className="flex-1 p-7">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[#F1F1F3] tracking-tight">
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
                className="w-full pl-10 pr-4 py-2.5 bg-[#2A2E38] border border-[#3A3E47] rounded-xl text-[#F1F1F3] placeholder-[#8E93A3] focus:border-[#6C82FF] focus:outline-none"
              />
            </div>

            {/* Templates grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredTemplates.map((template) => (
                <motion.button
                  key={template.id}
                  whileHover={{ y: -2, scale: 1.01 }}
                  onClick={() => onSelectTemplate(template)}
                  className="p-4 bg-[#272B35] hover:bg-[#303543] border border-[#3A3E47] rounded-xl text-left transition-all duration-200 group"
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
                  
                  <div className="flex items-center justify-center w-full py-2 bg-[#6C82FF] hover:bg-[#5A6FE8] text-white rounded-lg text-sm font-medium transition-colors">
                    Use Pack
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
