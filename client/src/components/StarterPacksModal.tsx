import FocusTrap from 'focus-trap-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Users,
  Sparkles,
  Briefcase,
  ShoppingBag,
  Palette,
  User,
  TrendingUp,
  Settings,
  GraduationCap,
  Lightbulb
} from 'lucide-react';
// Temporary inline template data until import issues are resolved
interface StarterPack {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  members: string[];
  welcomeMessage: string;
}

interface TemplateCategory {
  id: string;
  title: string;
  icon: string;
  packs: StarterPack[];
}

// Complete template data with 40+ templates across 8 categories
const starterPacksByCategory: Record<string, TemplateCategory> = {
  business: {
    id: "business",
    title: "Business + Startups",
    icon: "Briefcase",
    packs: [
      {
        id: "saas-startup",
        title: "SaaS Startup",
        description: "Perfect for launching software products and digital platforms",
        emoji: "🚀",
        color: "blue",
        members: ["Product Manager", "Technical Lead", "Copywriter"],
        welcomeMessage: "Ready to build your SaaS product! Let's turn your idea into a successful software business."
      },
      {
        id: "ai-tool-startup",
        title: "AI Tool Startup",
        description: "Build cutting-edge AI-powered tools and applications",
        emoji: "🤖",
        color: "purple",
        members: ["AI Developer", "Product Manager", "Growth Marketer"],
        welcomeMessage: "Let's create innovative AI tools that solve real problems and delight users."
      },
      {
        id: "marketplace-app",
        title: "Marketplace App",
        description: "Create platforms that connect buyers and sellers",
        emoji: "🏪",
        color: "green",
        members: ["UX Designer", "Technical Lead", "Operations Manager"],
        welcomeMessage: "Building marketplaces that bring people together and create value for everyone."
      },
      {
        id: "solo-founder-support",
        title: "Solo Founder Support",
        description: "Essential support team for independent entrepreneurs",
        emoji: "👤",
        color: "amber",
        members: ["Product Manager", "Copywriter", "Operations Manager"],
        welcomeMessage: "You're not alone! This team will help you navigate every aspect of building your business."
      },
      {
        id: "investor-deck-sprint",
        title: "Investor Deck Sprint",
        description: "Create compelling pitch decks that secure funding",
        emoji: "📊",
        color: "blue",
        members: ["Product Manager", "Brand Strategist", "UI Designer"],
        welcomeMessage: "Let's craft a pitch deck that tells your story and wins over investors."
      }
    ]
  },
  brands: {
    id: "brands",
    title: "Brands & Commerce",
    icon: "ShoppingBag",
    packs: [
      {
        id: "ecommerce-launch",
        title: "E-commerce Launch",
        description: "Launch and grow your online retail business",
        emoji: "🛍️",
        color: "green",
        members: ["Brand Strategist", "Copywriter", "UI Designer"],
        welcomeMessage: "Ready to launch your e-commerce store and create an amazing shopping experience!"
      },
      {
        id: "dtc-brand-strategy",
        title: "DTC Brand Strategy",
        description: "Direct-to-consumer brand building and growth",
        emoji: "📦",
        color: "purple",
        members: ["Product Manager", "Growth Marketer", "Social Media Manager"],
        welcomeMessage: "Building direct relationships with customers and growing your brand authentically."
      },
      {
        id: "amazon-store-optimization",
        title: "Amazon Store Optimization",
        description: "Optimize your Amazon presence for maximum sales",
        emoji: "📈",
        color: "amber",
        members: ["SEO Specialist", "Copywriter", "Data Analyst"],
        welcomeMessage: "Let's optimize your Amazon store to rank higher and convert better."
      },
      {
        id: "product-packaging-revamp",
        title: "Product Packaging Revamp",
        description: "Redesign packaging that stands out and sells",
        emoji: "📦",
        color: "blue",
        members: ["Brand Strategist", "UI Designer", "Creative Director"],
        welcomeMessage: "Creating packaging that tells your brand story and captivates customers."
      }
    ]
  },
  creative: {
    id: "creative",
    title: "Creative & Content",
    icon: "Palette",
    packs: [
      {
        id: "creative-studio",
        title: "Creative Studio",
        description: "Full-service creative team for branding and design",
        emoji: "🎨",
        color: "purple",
        members: ["Creative Director", "Brand Strategist", "Copywriter"],
        welcomeMessage: "Ready to bring creative visions to life with stunning design and compelling storytelling."
      },
      {
        id: "portfolio-builder",
        title: "Portfolio Builder",
        description: "Showcase your work with a stunning portfolio",
        emoji: "💼",
        color: "blue",
        members: ["UI Designer", "Copywriter", "UX Designer"],
        welcomeMessage: "Let's create a portfolio that showcases your best work and attracts dream clients."
      },
      {
        id: "content-calendar-builder",
        title: "Content Calendar Builder",
        description: "Strategic content planning and social media management",
        emoji: "📅",
        color: "green",
        members: ["Social Media Manager", "Growth Marketer", "Copywriter"],
        welcomeMessage: "Planning content that engages your audience and grows your following consistently."
      },
      {
        id: "youtube-channel-strategy",
        title: "YouTube Channel Strategy",
        description: "Grow your YouTube channel with strategic content",
        emoji: "📺",
        color: "amber",
        members: ["Social Media Manager", "Creative Director", "SEO Specialist"],
        welcomeMessage: "Building a YouTube channel that attracts subscribers and keeps them coming back."
      },
      {
        id: "podcast-launch",
        title: "Podcast Launch",
        description: "Launch and grow your podcast audience",
        emoji: "🎙️",
        color: "purple",
        members: ["Audio Editor", "Copywriter", "Brand Strategist"],
        welcomeMessage: "Ready to share your voice with the world through compelling podcast content."
      }
    ]
  },
  freelancers: {
    id: "freelancers",
    title: "Freelancers & Solopreneurs",
    icon: "User",
    packs: [
      {
        id: "freelance-brand-kit",
        title: "Freelance Brand Kit",
        description: "Complete branding package for independent professionals",
        emoji: "⭐",
        color: "amber",
        members: ["Copywriter", "UI Designer", "Brand Strategist"],
        welcomeMessage: "Building a personal brand that attracts ideal clients and premium projects."
      },
      {
        id: "client-pitch-kit",
        title: "Client Pitch Kit",
        description: "Win more clients with compelling proposals",
        emoji: "🎯",
        color: "blue",
        members: ["Copywriter", "Product Manager", "Brand Strategist"],
        welcomeMessage: "Crafting proposals that showcase your value and win the clients you want."
      },
      {
        id: "notion-template-business",
        title: "Notion Template Business",
        description: "Create and sell digital productivity templates",
        emoji: "📝",
        color: "green",
        members: ["UX Designer", "Copywriter", "Growth Marketer"],
        welcomeMessage: "Building a business around helping others stay organized and productive."
      },
      {
        id: "newsletter-strategy",
        title: "Newsletter Strategy",
        description: "Build and monetize your email newsletter",
        emoji: "📧",
        color: "purple",
        members: ["Email Specialist", "Copywriter", "Growth Marketer"],
        welcomeMessage: "Growing a newsletter that provides value and generates sustainable income."
      }
    ]
  },
  growth: {
    id: "growth",
    title: "Growth & Marketing",
    icon: "TrendingUp",
    packs: [
      {
        id: "launch-campaign",
        title: "Launch Campaign",
        description: "Comprehensive marketing campaigns for product launches",
        emoji: "🚀",
        color: "blue",
        members: ["Growth Marketer", "Copywriter", "UI Designer"],
        welcomeMessage: "Creating buzz and driving conversions for your product launch."
      },
      {
        id: "ad-funnel-builder",
        title: "Ad Funnel Builder",
        description: "High-converting advertising funnels and campaigns",
        emoji: "🎯",
        color: "green",
        members: ["Copywriter", "UI Designer", "Data Analyst"],
        welcomeMessage: "Building funnels that turn ad clicks into loyal customers."
      },
      {
        id: "seo-sprint",
        title: "SEO Sprint",
        description: "Boost your search rankings and organic traffic",
        emoji: "📈",
        color: "amber",
        members: ["SEO Specialist", "Copywriter", "Data Analyst"],
        welcomeMessage: "Optimizing your content to rank higher and attract more organic traffic."
      },
      {
        id: "email-sequence-builder",
        title: "Email Sequence Builder",
        description: "Automated email sequences that nurture and convert",
        emoji: "📨",
        color: "purple",
        members: ["Email Specialist", "Copywriter", "Brand Strategist"],
        welcomeMessage: "Creating email sequences that build relationships and drive sales."
      }
    ]
  },
  internal: {
    id: "internal",
    title: "Internal Teams & Ops",
    icon: "Settings",
    packs: [
      {
        id: "team-onboarding-kit",
        title: "Team Onboarding Kit",
        description: "Streamlined onboarding for new team members",
        emoji: "👥",
        color: "blue",
        members: ["Product Manager", "HR Specialist", "Operations Manager"],
        welcomeMessage: "Creating smooth onboarding experiences that set new hires up for success."
      },
      {
        id: "weekly-sync-system",
        title: "Weekly Sync System",
        description: "Effective team communication and alignment",
        emoji: "🔄",
        color: "green",
        members: ["Operations Manager", "Product Manager", "UI Designer"],
        welcomeMessage: "Building systems that keep teams aligned and productive."
      },
      {
        id: "internal-wiki-setup",
        title: "Internal Wiki Setup",
        description: "Centralized knowledge base for your organization",
        emoji: "📚",
        color: "purple",
        members: ["UX Designer", "Copywriter", "Technical Lead"],
        welcomeMessage: "Organizing company knowledge so everyone can find what they need quickly."
      }
    ]
  },
  education: {
    id: "education",
    title: "Education & Research",
    icon: "GraduationCap",
    packs: [
      {
        id: "online-course-builder",
        title: "Online Course Builder",
        description: "Create engaging educational content and courses",
        emoji: "🎓",
        color: "blue",
        members: ["Instructional Designer", "Copywriter", "Brand Strategist"],
        welcomeMessage: "Building courses that educate, engage, and transform students' lives."
      },
      {
        id: "academic-research",
        title: "Academic Research",
        description: "Research support and publication assistance",
        emoji: "🔬",
        color: "purple",
        members: ["Data Analyst", "Copywriter", "Brand Strategist"],
        welcomeMessage: "Supporting rigorous research that advances knowledge and impacts the field."
      },
      {
        id: "slide-deck-assistant",
        title: "Slide Deck Assistant",
        description: "Professional presentations that captivate audiences",
        emoji: "📊",
        color: "amber",
        members: ["Product Manager", "Copywriter", "UI Designer"],
        welcomeMessage: "Creating presentations that tell compelling stories and drive action."
      }
    ]
  },
  personal: {
    id: "personal",
    title: "Personal & Experimental",
    icon: "Lightbulb",
    packs: [
      {
        id: "side-hustle-brainstormer",
        title: "Side Hustle Brainstormer",
        description: "Explore and validate side business ideas",
        emoji: "💡",
        color: "amber",
        members: ["AI Developer", "Growth Marketer", "Copywriter"],
        welcomeMessage: "Exploring side hustle ideas that could become your next big opportunity."
      },
      {
        id: "life-dashboard-builder",
        title: "Life Dashboard Builder",
        description: "Personal productivity and life management system",
        emoji: "📊",
        color: "blue",
        members: ["UX Designer", "Copywriter", "UI Designer"],
        welcomeMessage: "Building systems to track and optimize all areas of your life."
      },
      {
        id: "ai-character-creator",
        title: "AI Character Creator",
        description: "Design and develop AI personas and characters",
        emoji: "🎭",
        color: "purple",
        members: ["Creative Director", "AI Developer", "Copywriter"],
        welcomeMessage: "Creating AI characters with personality, depth, and unique voices."
      },
      {
        id: "personal-knowledge-base",
        title: "Personal Knowledge Base",
        description: "Organize and connect your ideas and learnings",
        emoji: "🧠",
        color: "green",
        members: ["Operations Manager", "UX Designer", "Copywriter"],
        welcomeMessage: "Building a second brain to capture, organize, and connect your knowledge."
      },
      {
        id: "moodboard-generator",
        title: "Moodboard Generator",
        description: "Visual inspiration and creative direction tools",
        emoji: "🎨",
        color: "amber",
        members: ["Creative Director", "UI Designer", "Copywriter"],
        welcomeMessage: "Curating visual inspiration that sparks creativity and guides design decisions."
      }
    ]
  }
};

const getHatchTemplate = (name: string) => ({
  name,
  role: name,
  description: `Expert ${name} with specialized skills`,
  color: "blue" as const,
  category: "general"
});

// Icon mapping for categories
const categoryIcons = {
  Briefcase,
  ShoppingBag,
  Palette,
  User,
  TrendingUp,
  Settings,
  GraduationCap,
  Lightbulb
};

// Category accent colors mapping
const categoryAccents: Record<string, { border: string; bg: string; text: string }> = {
  business: { border: '#6C82FF', bg: '#6C82FF20', text: '#6C82FF' },
  creative: { border: '#9F7BFF', bg: '#9F7BFF20', text: '#9F7BFF' },
  growth: { border: '#FF8C42', bg: '#FF8C4220', text: '#FF8C42' },
  content: { border: '#FF6B9D', bg: '#FF6B9D20', text: '#FF6B9D' },
  education: { border: '#47DB9A', bg: '#47DB9A20', text: '#47DB9A' },
  personal: { border: '#FFCE3A', bg: '#FFCE3A20', text: '#FFCE3A' },
  operations: { border: '#4BC8FF', bg: '#4BC8FF20', text: '#4BC8FF' },
  influencer: { border: '#E84CFF', bg: '#E84CFF2020', text: '#E84CFF' },
};

interface StarterPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSelectTemplate: (pack: StarterPack) => void;
  isLoading?: boolean;
  selectedPackId?: string;
}

export default function StarterPacksModal({
  isOpen,
  onClose,
  onBack,
  onSelectTemplate,
  isLoading = false,
  selectedPackId
}: StarterPacksModalProps) {
  const [activeCategory, setActiveCategory] = useState('business');
  const [selectedPack, setSelectedPack] = useState<string | null>(selectedPackId || null);

  const handleSelectPack = (pack: StarterPack) => {
    setSelectedPack(pack.id);
    onSelectTemplate(pack);
  };

  // Reset selected pack when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedPack(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <FocusTrap active={isOpen}>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#23262B] rounded-2xl border border-[#43444B] shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ width: '1200px', height: '700px' }}>
          {/* Header */}
          <div className="p-6 border-b border-[#43444B] flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h2 className="text-xl font-semibold text-[#F1F1F3] mb-1" id="modal-title">
                  Choose Your Starter Template
                </h2>
                <p className="text-[#A6A7AB] text-sm">
                  Select a pre-built team to get started quickly, or explore ideas if you're not sure what to build.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Area with Sidebar Layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* Category Sidebar */}
            <div className="w-64 border-r border-[#43444B] bg-[#1A1C1F]">
              <div className="p-4">
                <div className="space-y-1">
                  {Object.entries(starterPacksByCategory).map(([categoryId, category]: [string, TemplateCategory]) => {
                    const IconComponent = categoryIcons[category.icon as keyof typeof categoryIcons] || Briefcase;
                    const packCount = category.packs.length;

                    const accent = categoryAccents[categoryId] || categoryAccents['business'];
                    return (
                      <button
                        key={categoryId}
                        onClick={() => setActiveCategory(categoryId)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${activeCategory === categoryId
                          ? 'text-white'
                          : 'text-[#A6A7AB] hover:bg-[#37383B] hover:text-[#F1F1F3]'
                          }`}
                        style={activeCategory === categoryId ? {
                          backgroundColor: accent.bg,
                          borderLeft: `3px solid ${accent.border}`,
                          paddingLeft: '10px'
                        } : {}}
                      >
                        <IconComponent size={16} className="flex-shrink-0" style={activeCategory === categoryId ? { color: accent.text } : {}} />
                        <span className="text-sm font-medium flex-1">{category.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${activeCategory === categoryId
                          ? 'bg-white/20 text-white'
                          : 'bg-[#43444B] text-[#A6A7AB]'
                          }`}>
                          {packCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Template Grid */}
            <div className="flex-1 overflow-y-auto scrollbar-stable">
              <div className="p-4">
                <div
                  className="grid gap-4 grid-cols-3"
                  style={{
                    gridTemplateColumns: 'repeat(3, 1fr)'
                  }}
                >
                  {starterPacksByCategory[activeCategory]?.packs.map((pack, i) => (
                    <TemplateCard
                      key={`${activeCategory}-${pack.id}`}
                      pack={pack}
                      index={i}
                      isSelected={selectedPack === pack.id}
                      isLoading={isLoading && selectedPack === pack.id}
                      onSelect={() => handleSelectPack(pack)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}

interface TemplateCardProps {
  pack: StarterPack;
  index: number;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
}

function TemplateCard({ pack, index, isSelected, isLoading, onSelect }: TemplateCardProps) {
  return (
    <motion.div
      className={`relative bg-gradient-to-br from-[#2A2D33] to-[#1D1F23] rounded-xl p-4 border transition-all duration-300 cursor-pointer flex flex-col group overflow-hidden ${isSelected ? 'border-hatchin-blue shadow-[0_0_20px_rgba(108,130,255,0.2)]' : 'border-[#43444B] hover:border-hatchin-blue/50 hover:shadow-[0_8px_30px_rgba(108,130,255,0.15)]'}`}
      style={{
        minHeight: '200px',
        transformStyle: 'preserve-3d'
      }}
      onClick={onSelect}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      whileHover={{ y: -4, scale: 1.02, rotateY: 3, rotateX: 2 }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Pack Header */}
      <div className="relative z-10 flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-[0_0_15px_rgba(108,130,255,0.15)] group-hover:shadow-[0_0_25px_rgba(108,130,255,0.25)] transition-shadow ${pack.color === 'blue' ? 'bg-gradient-to-br from-hatchin-blue/20 to-[#9F7BFF]/20 border border-hatchin-blue/30' :
              pack.color === 'green' ? 'bg-gradient-to-br from-[#47DB9A]/20 to-emerald-500/20 border border-[#47DB9A]/30' :
                pack.color === 'purple' ? 'bg-gradient-to-br from-[#9F7BFF]/20 to-fuchsia-500/20 border border-[#9F7BFF]/30' :
                  pack.color === 'amber' ? 'bg-gradient-to-br from-[#FFB547]/20 to-amber-500/20 border border-[#FFB547]/30' :
                    pack.color === 'red' ? 'bg-gradient-to-br from-[#FF4E6A]/20 to-rose-500/20 border border-[#FF4E6A]/30' :
                      'bg-gradient-to-br from-hatchin-blue/20 to-[#9F7BFF]/20 border border-hatchin-blue/30'
            }`}>
            {pack.emoji}
          </div>
          <div className="flex-1">
            <h3 className="text-[#F1F1F3] text-sm mb-1 flex items-center gap-2" id="modal-title">
              {pack.title}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-hatchin-blue"
                >
                  <Sparkles size={10} />
                </motion.div>
              )}
            </h3>
            <p className="text-[#A6A7AB] text-xs leading-tight">
              {pack.description}
            </p>
          </div>
        </div>
        <div className="ml-1 text-[#A6A7AB] flex items-center gap-1">
          <Users size={10} />
          <span className="text-xs">{pack.members.length}</span>
        </div>
      </div>
      {/* Team Preview - Compact */}
      <div className="mt-2 mb-2">
        <div className="flex flex-wrap gap-1">
          {pack.members.slice(0, 4).map((memberName: string) => {
            const hatch = getHatchTemplate(memberName);
            return (
              <div key={memberName} className="flex items-center gap-1 bg-[#23262B] rounded px-2 py-1">
                <User className={`w-3 h-3 ${pack.color === 'blue' ? 'text-hatchin-blue' :
                  pack.color === 'green' ? 'text-[#47DB9A]' :
                    pack.color === 'purple' ? 'text-[#9F7BFF]' :
                      pack.color === 'amber' ? 'text-[#FFB547]' :
                        'text-hatchin-blue'
                  }`} />
                <span className="text-xs text-[#F1F1F3]">{memberName}</span>
              </div>
            );
          })}

          {pack.members.length > 4 && (
            <div className="flex items-center justify-center bg-[#23262B] rounded px-2 py-1">
              <span className="text-xs text-[#A6A7AB]">+{pack.members.length - 4}</span>
            </div>
          )}
        </div>
      </div>
      {/* CTA Button - Fixed at bottom */}
      <div className="mt-auto pt-2">
        <button
          className={`w-full px-3 py-2 rounded-lg transition-all duration-200 text-xs font-medium ${isSelected
            ? 'bg-hatchin-blue text-white'
            : 'bg-[#43444B] hover:bg-hatchin-blue text-[#F1F1F3] hover:text-white'
            }`}
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : isSelected ? 'Starting...' : 'Use Pack'}
        </button>
      </div>
    </motion.div>
  );
}