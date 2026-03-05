// Template system for starter packs and project creation
// Based on actual Hatchin specifications

export interface HatchTemplate {
  name: string;
  role: string;
  description: string;
  color: "blue" | "green" | "purple" | "amber";
  category: string;
  skills?: string[];
  tools?: string[];
}

export interface StarterPack {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  members: string[];
  welcomeMessage: string;
}

export interface TemplateCategory {
  id: string;
  title: string;
  icon: any; // Will be imported from lucide-react
  packs: StarterPack[];
}

// Starter pack templates organized by category
export const starterPacksByCategory: Record<string, TemplateCategory> = {
  business: {
    id: "business",
    title: "Business + Startups",
    icon: "Briefcase", // lucide-react icon name
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
      ,
      {
        id: "media-production-house",
        title: "Media Production House",
        description: "End-to-end video and content production squad for brands, campaigns, and social media.",
        emoji: "🎬",
        color: "purple",
        members: ["Creative Director", "Copywriter", "Audio Editor"],
        welcomeMessage: "Lights, camera, action. This production house team turns rough ideas into scripts, shoots, and polished edits that are ready to publish."
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

// Hatch template definitions for team members
export const allHatchTemplates: HatchTemplate[] = [
  // Product & Strategy
  {
    name: "Product Manager",
    role: "Product Manager",
    description: "Expert in product strategy, roadmapping, and turning ideas into actionable plans. Maya helps clarify concepts and build the right team.",
    color: "blue",
    category: "strategy",
    skills: ["Product Strategy", "Roadmapping", "Team Building", "Idea Development"]
  },
  {
    name: "Business Strategist",
    role: "Business Strategist",
    description: "Strategic thinking and business model expert. Morgan helps analyze markets, identify opportunities, and create winning strategies.",
    color: "purple",
    category: "strategy",
    skills: ["Business Strategy", "Market Analysis", "Competitive Intelligence", "Strategic Planning"]
  },
  {
    name: "Data Analyst",
    role: "Data Analyst",
    description: "Data-driven insights and analytics specialist. Quinn transforms raw data into actionable business intelligence and clear visualizations.",
    color: "amber",
    category: "analytics",
    skills: ["Data Analysis", "Business Intelligence", "Visualization", "Insights"]
  },

  // Development & Tech
  {
    name: "Technical Lead",
    role: "Technical Lead",
    description: "Versatile developer skilled in both frontend and backend technologies. Alex brings technical ideas to life with clean, scalable code.",
    color: "blue",
    category: "development",
    skills: ["Web Development", "API Design", "Database Architecture", "System Integration"]
  },
  {
    name: "AI Developer",
    role: "AI Developer",
    description: "Artificial intelligence and machine learning specialist. Jordan creates intelligent systems that solve complex problems.",
    color: "green",
    category: "development",
    skills: ["Machine Learning", "AI Development", "Data Science", "Neural Networks"]
  },
  {
    name: "UX Designer",
    role: "UX Designer",
    description: "User experience and interface design expert. Sam creates intuitive, beautiful interfaces that users love to interact with.",
    color: "green",
    category: "design",
    skills: ["User Research", "Interface Design", "Prototyping", "Design Systems"]
  },

  // Design & Creative
  {
    name: "UI Designer",
    role: "UI Designer",
    description: "Visual design and user interface specialist. Taylor creates compelling visual experiences that engage and convert.",
    color: "amber",
    category: "design",
    skills: ["Visual Design", "Interface Design", "Brand Identity", "Design Systems"]
  },
  {
    name: "Brand Strategist",
    role: "Brand Strategist",
    description: "Brand identity and strategy specialist. Charlie develops compelling brand experiences that resonate with target audiences.",
    color: "blue",
    category: "creative",
    skills: ["Brand Strategy", "Visual Identity", "Brand Voice", "Marketing Materials"]
  },
  {
    name: "Creative Director",
    role: "Creative Director",
    description: "Creative leadership and vision expert. Riley guides creative projects from concept to execution with artistic excellence.",
    color: "purple",
    category: "creative",
    skills: ["Creative Direction", "Art Direction", "Campaign Development", "Visual Storytelling"]
  },
  {
    name: "Copywriter",
    role: "Copywriter",
    description: "Content strategy and copywriting expert. Morgan crafts compelling narratives that engage audiences and drive action.",
    color: "green",
    category: "content",
    skills: ["Content Strategy", "Copywriting", "Brand Voice", "SEO Writing"]
  },

  // Marketing & Growth
  {
    name: "Growth Marketer",
    role: "Growth Marketer",
    description: "Digital marketing and growth expert. Dakota develops comprehensive marketing strategies that drive user acquisition and engagement.",
    color: "green",
    category: "marketing",
    skills: ["Digital Marketing", "Growth Strategy", "Campaign Management", "Analytics"]
  },
  {
    name: "Social Media Manager",
    role: "Social Media Manager",
    description: "Social media strategy and community building expert. Sage creates engaging social content and builds loyal communities.",
    color: "purple",
    category: "marketing",
    skills: ["Social Media Strategy", "Community Building", "Content Creation", "Engagement"]
  },
  {
    name: "SEO Specialist",
    role: "SEO Specialist",
    description: "Search engine optimization and organic growth expert. Casey helps content rank higher and attract more organic traffic.",
    color: "amber",
    category: "marketing",
    skills: ["SEO Strategy", "Keyword Research", "Content Optimization", "Technical SEO"]
  },
  {
    name: "Email Specialist",
    role: "Email Specialist",
    description: "Email marketing and automation expert. Avery creates email sequences that nurture leads and convert customers.",
    color: "blue",
    category: "marketing",
    skills: ["Email Marketing", "Marketing Automation", "List Building", "Conversion Optimization"]
  },

  // Operations & Support
  {
    name: "Operations Manager",
    role: "Operations Manager",
    description: "Process optimization and operational efficiency expert. Dakota streamlines workflows and ensures smooth day-to-day operations.",
    color: "purple",
    category: "operations",
    skills: ["Process Optimization", "Project Management", "Team Coordination", "Efficiency"]
  },
  {
    name: "HR Specialist",
    role: "HR Specialist",
    description: "Human resources and team development expert. Harper builds positive workplace culture and supports team growth.",
    color: "green",
    category: "operations",
    skills: ["Talent Acquisition", "Team Development", "Culture Building", "Performance Management"]
  },
  {
    name: "Instructional Designer",
    role: "Instructional Designer",
    description: "Learning experience and educational content expert. Emery creates engaging educational materials that help people learn effectively.",
    color: "blue",
    category: "education",
    skills: ["Learning Design", "Curriculum Development", "Educational Technology", "Assessment Design"]
  },
  {
    name: "Audio Editor",
    role: "Audio Editor",
    description: "Audio production and podcast editing expert. River creates professional audio content that sounds amazing and engages listeners.",
    color: "amber",
    category: "creative",
    skills: ["Audio Editing", "Sound Design", "Podcast Production", "Music Composition"]
  }
];

// Helper functions
export const getHatchTemplate = (name: string): HatchTemplate | undefined => {
  return allHatchTemplates.find(template => template.name === name);
};

export const getStarterPack = (id: string): StarterPack | undefined => {
  for (const category of Object.values(starterPacksByCategory)) {
    const pack = category.packs.find(p => p.id === id);
    if (pack) return pack;
  }
  return undefined;
};

export const getAllStarterPacks = (): StarterPack[] => {
  return Object.values(starterPacksByCategory).flatMap(category => category.packs);
};