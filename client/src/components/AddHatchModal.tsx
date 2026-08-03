import { devLog } from '@/lib/devLog';
import React, { useState, useMemo, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, Search, Users, User, Sparkles, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Project, Agent, Team } from '@shared/schema';
import AgentAvatar from '@/components/avatars/AgentAvatar';

interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  suggested?: boolean;
  agents: {
    name: string;
    role: string;
    color: string;
    initials: string;
  }[];
}

interface IndividualAgent {
  name: string;
  role: string;
  color: string;
  initials: string;
  description: string;
  expertise: string[];
}

interface AddHatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAgent: (agent: Omit<Agent, 'id'>) => void;
  activeProject: Project | null;
  existingAgents: Agent[];
  activeTeamId?: string | null;
}

const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'product-team',
    name: 'Product Team',
    description: 'Build and ship amazing products',
    icon: '📱',
    suggested: true,
    agents: [
      { name: 'Alex', role: 'Product Manager', color: 'blue', initials: 'PM' },
      { name: 'Arlo', role: 'UI Designer', color: 'green', initials: 'UD' },
      { name: 'Coda', role: 'Software Engineer', color: 'purple', initials: 'SE' }
    ]
  },
  {
    id: 'marketing-team',
    name: 'Marketing Team',
    description: 'Grow your audience and revenue',
    icon: '📈',
    agents: [
      { name: 'Kai', role: 'Growth Marketer', color: 'orange', initials: 'GM' },
      { name: 'Wren', role: 'Copywriter', color: 'pink', initials: 'CW' },
      { name: 'Mira', role: 'Content Writer', color: 'yellow', initials: 'CW' }
    ]
  },
  {
    id: 'design-team',
    name: 'Design Team',
    description: 'Create beautiful experiences',
    icon: '🎨',
    agents: [
      { name: 'Arlo', role: 'UI Designer', color: 'green', initials: 'UD' },
      { name: 'Cass', role: 'Brand Strategist', color: 'indigo', initials: 'BS' },
      { name: 'Wren', role: 'Copywriter', color: 'pink', initials: 'CW' }
    ]
  },
  {
    id: 'dev-team',
    name: 'Dev Team',
    description: 'Build robust and scalable systems',
    icon: '⚙️',
    agents: [
      { name: 'Coda', role: 'Software Engineer', color: 'purple', initials: 'SE' },
      { name: 'Alex', role: 'Product Manager', color: 'blue', initials: 'PM' },
      { name: 'Kai', role: 'Growth Marketer', color: 'orange', initials: 'GM' }
    ]
  },
  {
    id: 'launch-team',
    name: 'Launch Team',
    description: 'Successfully launch and scale your product',
    icon: '🚀',
    agents: [
      { name: 'Alex', role: 'Product Manager', color: 'blue', initials: 'PM' },
      { name: 'Kai', role: 'Growth Marketer', color: 'orange', initials: 'GM' },
      { name: 'Wren', role: 'Copywriter', color: 'pink', initials: 'CW' },
      { name: 'Nova', role: 'Marketing Specialist', color: 'cyan', initials: 'MS' }
    ]
  },
  {
    id: 'analytics-team',
    name: 'Analytics Team',
    description: 'Make data-driven decisions',
    icon: '📊',
    agents: [
      { name: 'Rio', role: 'Data Analyst', color: 'teal', initials: 'DA' },
      { name: 'Kai', role: 'Growth Marketer', color: 'orange', initials: 'GM' },
      { name: 'Alex', role: 'Product Manager', color: 'blue', initials: 'PM' }
    ]
  },
  {
    id: 'content-team',
    name: 'Content Team',
    description: 'Create engaging content and storytelling',
    icon: '✍️',
    agents: [
      { name: 'Mira', role: 'Content Writer', color: 'yellow', initials: 'CW' },
      { name: 'Wren', role: 'Copywriter', color: 'pink', initials: 'CW' },
      { name: 'Cass', role: 'Brand Strategist', color: 'indigo', initials: 'BS' },
      { name: 'Nova', role: 'Marketing Specialist', color: 'cyan', initials: 'MS' }
    ]
  },
  {
    id: 'support-team',
    name: 'Customer Success',
    description: 'Ensure customer satisfaction and retention',
    icon: '🤝',
    agents: [
      { name: 'Quinn', role: 'Operations Manager', color: 'emerald', initials: 'OM' },
      { name: 'Wren', role: 'Copywriter', color: 'pink', initials: 'CW' },
      { name: 'Kai', role: 'Growth Marketer', color: 'orange', initials: 'GM' }
    ]
  }
];

const INDIVIDUAL_AGENTS: IndividualAgent[] = [
  {
    name: 'Alex',
    role: 'Product Manager',
    color: 'blue',
    initials: 'PM',
    description: 'Leads product strategy, roadmap planning, and cross-functional coordination to deliver user-centered solutions.',
    expertise: ['Product Strategy', 'User Research', 'Roadmap Planning']
  },
  {
    name: 'Cleo',
    role: 'Product Designer',
    color: 'green',
    initials: 'PD',
    description: 'Creates intuitive user experiences and beautiful interfaces through research-driven design.',
    expertise: ['UI/UX Design', 'Prototyping', 'User Testing']
  },
  {
    name: 'Finn',
    role: 'UI Engineer',
    color: 'purple',
    initials: 'UE',
    description: 'Builds responsive frontend applications with modern frameworks and best practices.',
    expertise: ['React', 'TypeScript', 'Frontend Architecture']
  },
  {
    name: 'Dev',
    role: 'Backend Developer',
    color: 'red',
    initials: 'BD',
    description: 'Develops scalable server architecture, APIs, and database systems for robust applications.',
    expertise: ['Node.js', 'Databases', 'API Design']
  },
  {
    name: 'Kai',
    role: 'Growth Marketer',
    color: 'orange',
    initials: 'GE',
    description: 'Drives user acquisition, retention, and revenue growth through data-driven strategies.',
    expertise: ['Growth Hacking', 'Analytics', 'User Acquisition']
  },
  {
    name: 'Wren',
    role: 'Copywriter',
    color: 'pink',
    initials: 'CW',
    description: 'Crafts compelling copy and messaging that converts visitors into customers.',
    expertise: ['Copywriting', 'Brand Voice', 'Conversion Optimization']
  },
  {
    name: 'Mira',
    role: 'Content Writer',
    color: 'yellow',
    initials: 'CC',
    description: 'Develops engaging content strategies and creates multimedia content that resonates with audiences.',
    expertise: ['Content Strategy', 'Video Production', 'Social Media']
  },
  {
    name: 'Cass',
    role: 'Brand Strategist',
    color: 'indigo',
    initials: 'BS',
    description: 'Shapes brand identity, positioning, and messaging to create memorable brand experiences.',
    expertise: ['Brand Strategy', 'Market Positioning', 'Brand Identity']
  },
  {
    name: 'Quinn',
    role: 'Operations Manager',
    color: 'emerald',
    initials: 'CS',
    description: 'Ensures operational excellence, process optimization, and builds efficient team workflows.',
    expertise: ['Operations', 'Process Design', 'Team Coordination']
  },
  {
    name: 'Nova',
    role: 'Marketing Specialist',
    color: 'cyan',
    initials: 'PR',
    description: 'Manages marketing campaigns, outreach, and builds brand awareness through strategic communications.',
    expertise: ['Marketing Strategy', 'Campaigns', 'Brand Awareness']
  },
  {
    name: 'Rio',
    role: 'Data Analyst',
    color: 'teal',
    initials: 'DA',
    description: 'Analyzes user behavior and business metrics to provide actionable insights for decision-making.',
    expertise: ['Data Analysis', 'Business Intelligence', 'Reporting']
  },
  {
    name: 'Blake',
    role: 'Business Strategist',
    color: 'rose',
    initials: 'SE',
    description: 'Drives business growth through strategic planning, market analysis, and relationship building.',
    expertise: ['Business Strategy', 'Market Analysis', 'Growth Planning']
  },
  {
    name: 'Remy',
    role: 'DevOps Engineer',
    color: 'slate',
    initials: 'DO',
    description: 'Manages infrastructure, deployment pipelines, and ensures reliable, scalable system operations.',
    expertise: ['CI/CD', 'Cloud Infrastructure', 'Monitoring']
  },
  {
    name: 'Sam',
    role: 'QA Lead',
    color: 'amber',
    initials: 'QA',
    description: 'Ensures product quality through comprehensive testing strategies and quality assurance processes.',
    expertise: ['Test Automation', 'Quality Processes', 'Bug Tracking']
  },
  {
    name: 'Morgan',
    role: 'Business Analyst',
    color: 'sky',
    initials: 'BA',
    description: 'Bridges business needs and technical solutions through requirements analysis and process modeling.',
    expertise: ['Requirements Analysis', 'Process Modeling', 'Stakeholder Management']
  },
  {
    name: 'Coda',
    role: 'Software Engineer',
    color: 'violet',
    initials: 'SE',
    description: 'Builds reliable, maintainable software systems with a focus on clean architecture and code quality.',
    expertise: ['Software Architecture', 'Code Quality', 'System Design']
  },
  {
    name: 'Jordan',
    role: 'Technical Lead',
    color: 'zinc',
    initials: 'TL',
    description: 'Guides technical direction, mentors engineers, and ensures architectural consistency across the stack.',
    expertise: ['Tech Strategy', 'Code Review', 'Architecture']
  },
  {
    name: 'Nyx',
    role: 'AI Developer',
    color: 'fuchsia',
    initials: 'AI',
    description: 'Designs and implements machine learning models, AI pipelines, and intelligent automation systems.',
    expertise: ['Machine Learning', 'NLP', 'AI Systems']
  },
  {
    name: 'Lumi',
    role: 'UX Designer',
    color: 'lime',
    initials: 'UX',
    description: 'Champions user-centered design through research, testing, and intuitive interaction patterns.',
    expertise: ['UX Research', 'Interaction Design', 'Usability Testing']
  },
  {
    name: 'Arlo',
    role: 'UI Designer',
    color: 'green',
    initials: 'UD',
    description: 'Creates visually stunning interfaces with meticulous attention to typography, color, and layout.',
    expertise: ['Visual Design', 'Design Systems', 'Typography']
  },
  {
    name: 'Roux',
    role: 'Designer',
    color: 'orange',
    initials: 'DS',
    description: 'Versatile designer covering visual, product, and graphic design with a creative eye.',
    expertise: ['Graphic Design', 'Visual Identity', 'Creative Direction']
  },
  {
    name: 'Zara',
    role: 'Creative Director',
    color: 'rose',
    initials: 'CD',
    description: 'Sets creative vision and ensures brand consistency across all touchpoints and campaigns.',
    expertise: ['Creative Strategy', 'Art Direction', 'Brand Storytelling']
  },
  {
    name: 'Robin',
    role: 'SEO Specialist',
    color: 'emerald',
    initials: 'SS',
    description: 'Optimizes search visibility through technical SEO, content strategy, and performance analytics.',
    expertise: ['Technical SEO', 'Keyword Research', 'Search Analytics']
  },
  {
    name: 'Pixel',
    role: 'Social Media Manager',
    color: 'cyan',
    initials: 'SM',
    description: 'Builds engaged communities and manages social presence across platforms with creative content.',
    expertise: ['Social Strategy', 'Community Management', 'Content Calendar']
  },
  {
    name: 'Drew',
    role: 'Email Specialist',
    color: 'amber',
    initials: 'ES',
    description: 'Designs high-converting email campaigns, automation flows, and subscriber growth strategies.',
    expertise: ['Email Marketing', 'Automation', 'A/B Testing']
  },
  {
    name: 'Sage',
    role: 'Data Scientist',
    color: 'teal',
    initials: 'DS',
    description: 'Extracts insights from complex datasets using statistical modeling and machine learning techniques.',
    expertise: ['Statistical Modeling', 'Data Visualization', 'Predictive Analytics']
  },
  {
    name: 'Taylor',
    role: 'HR Specialist',
    color: 'pink',
    initials: 'HR',
    description: 'Manages talent acquisition, team culture, and organizational development for growing teams.',
    expertise: ['Talent Management', 'Culture Building', 'Organizational Design']
  },
  {
    name: 'Lee',
    role: 'Instructional Designer',
    color: 'indigo',
    initials: 'ID',
    description: 'Creates effective learning experiences, training materials, and educational content.',
    expertise: ['Learning Design', 'Curriculum Development', 'E-Learning']
  },
  {
    name: 'Vince',
    role: 'Audio Editor',
    color: 'slate',
    initials: 'AE',
    description: 'Produces professional audio content including podcasts, music, and sound design.',
    expertise: ['Audio Production', 'Sound Design', 'Podcast Editing']
  }
];

const getColorClasses = (color: string) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    yellow: 'bg-yellow-500',
    indigo: 'bg-indigo-500',
    cyan: 'bg-cyan-500',
    teal: 'bg-teal-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
    amber: 'bg-amber-500'
  };
  return colorMap[color] || 'bg-gray-500';
};

export function AddHatchModal({ isOpen, onClose, onAddAgent, activeProject, activeTeamId }: AddHatchModalProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'individual'>('teams');
  const [searchQuery, setSearchQuery] = useState('');
  // Inline message for the Teams tab (e.g. when a pack is already on the project).
  const [packMessage, setPackMessage] = useState<string | null>(null);

  // Filter templates based on search
  const filteredTeamTemplates = useMemo(() => {
    if (!searchQuery) return TEAM_TEMPLATES;

    return TEAM_TEMPLATES.filter(template =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.agents.some(agent =>
        agent.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [searchQuery]);

  // Filter individual agents based on search
  const filteredIndividualAgents = useMemo(() => {
    if (!searchQuery) return INDIVIDUAL_AGENTS;

    return INDIVIDUAL_AGENTS.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.expertise.some(skill =>
        skill.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [searchQuery]);

  const handleUseTemplate = async (template: TeamTemplate) => {
    if (!activeProject) return;
    setPackMessage(null);

    try {
      // Guard (P0-C): don't silently add the same pack twice. If a team with this
      // pack's name already exists on the project, block with a clear message instead
      // of creating a duplicate team. Fail-open: if the check itself errors, proceed.
      try {
        const teamsResponse = await fetch(`/api/projects/${activeProject.id}/teams`);
        if (teamsResponse.ok) {
          const existingTeams = await teamsResponse.json();
          if (Array.isArray(existingTeams) && existingTeams.some((t: any) => t.name === template.name)) {
            setPackMessage(`${template.name} is already on your project. Add individual teammates instead, or remove the existing team first.`);
            return;
          }
        }
      } catch {
        // If the duplicate check fails, let creation proceed rather than blocking.
      }

      // First, create the team
      const teamData = {
        name: template.name,
        emoji: template.icon,
        projectId: activeProject.id,
        description: template.description
      };

      const teamResponse = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamData),
      });

      if (!teamResponse.ok) {
        console.error('Failed to create team');
        return;
      }

      const newTeam = await teamResponse.json();
      devLog('Team created successfully:', newTeam);

      // Then, create every agent the pack promises and assign them to the new team.
      // We intentionally do NOT skip roles that already exist elsewhere on the project
      // (P0-A/P0-B): each team is self-contained, so "Use Pack" always delivers the full
      // roster shown on the card, and the Teams tab now matches the Individual tab, which
      // already allows duplicate roles.
      for (const templateAgent of template.agents) {
        const agentData: Omit<Agent, 'id'> = {
          name: templateAgent.name, // Use character name from template
          role: templateAgent.role,
          color: templateAgent.color,
          userId: 'current-user',
          teamId: newTeam.id, // Assign to the newly created team
          projectId: activeProject.id,
          personality: {
            traits: [],
            communicationStyle: 'professional',
            expertise: [],
            welcomeMessage: `Hi! I'm ${templateAgent.name}, your ${templateAgent.role}. Ready to help ${template.name}!`
          },
          isSpecialAgent: false
        };

        onAddAgent(agentData);
      }

      devLog(`Team "${template.name}" created with ${template.agents.length} agents`);
      onClose();
    } catch (error) {
      console.error('Error creating team template:', error);
    }
  };

  const handleAddIndividualAgent = async (agent: IndividualAgent) => {
    if (!activeProject) return;

    // Allow duplicate roles - just create the agent
    devLog(`Creating agent with role "${agent.role}" for project ${activeProject.id}`);

    try {
      let targetTeamId = activeTeamId;

      // If no team is selected, create or find Individual Agents team
      if (!targetTeamId) {
        const teamsResponse = await fetch(`/api/projects/${activeProject.id}/teams`);
        const teams = await teamsResponse.json();

        // Look for existing Individual Agents team
        let individualTeam = teams.find((team: any) => team.name === 'Individual Agents');

        // If no Individual Agents team exists, create one
        if (!individualTeam) {
          const teamResponse = await fetch('/api/teams', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'Individual Agents',
              emoji: '👤',
              projectId: activeProject.id,
            }),
          });

          if (!teamResponse.ok) {
            console.error('Failed to create Individual Agents team');
            return;
          }

          individualTeam = await teamResponse.json();
          devLog('Created Individual Agents team:', individualTeam);
        }

        targetTeamId = individualTeam.id;
      }

      const agentData: Omit<Agent, 'id'> = {
        name: agent.name, // Use character name (e.g., "Alex" not "Product Manager")
        role: agent.role,
        color: agent.color,
        userId: 'current-user',
        teamId: targetTeamId!, // Assign to selected team or Individual Agents team
        projectId: activeProject.id,
        personality: {
          traits: [],
          communicationStyle: 'professional',
          expertise: agent.expertise,
          welcomeMessage: `Hi! I'm your ${agent.role}. ${agent.description}`
        },
        isSpecialAgent: false
      };

      devLog('Creating individual agent:', agentData);
      onAddAgent(agentData);
      onClose();
    } catch (error) {
      console.error('Error creating individual agent:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <FocusTrap active={isOpen}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.15 }}
              className="bg-hatchin-card rounded-2xl border border-hatchin-border-subtle shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="modal-title"
              style={{ width: '1200px', height: '700px' }}
            >
              {/* Header */}
              <div className="p-6 border-b border-hatchin-border-subtle flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-hatchin-text-bright mb-1" id="modal-title">
                    Add Hatch
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Add AI teammates to {activeProject?.name || 'your project'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-hatchin-text-bright transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content Area with Sidebar Layout */}
              <div className="flex flex-1 overflow-hidden">
                {/* Category Sidebar */}
                <div className="w-64 border-r border-hatchin-border-subtle bg-hatchin-panel">
                  <div className="p-4">
                    <div className="space-y-1">
                      <button
                        onClick={() => { setActiveTab('teams'); setPackMessage(null); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${activeTab === 'teams'
                          ? 'bg-hatchin-blue text-white'
                          : 'text-muted-foreground hover:text-hatchin-text-bright hover:bg-hatchin-surface-elevated'
                          }`}
                      >
                        <Users size={20} />
                        <div className="flex-1">
                          <div className="text-[14px] font-bold">Teams Template</div>
                          <div className="text-xs opacity-75">Pre-built teams</div>
                        </div>
                        <div className="text-xs bg-black/20 px-2 py-1 rounded-full">
                          {TEAM_TEMPLATES.length}
                        </div>
                      </button>

                      <button
                        onClick={() => { setActiveTab('individual'); setPackMessage(null); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 mt-[13px] mb-[13px] ${activeTab === 'individual'
                          ? 'bg-hatchin-blue text-white'
                          : 'text-muted-foreground hover:text-hatchin-text-bright hover:bg-hatchin-surface-elevated'
                          }`}
                      >
                        <User size={20} />
                        <div className="flex-1">
                          <div className="font-medium text-[14px]">Individual Hatch</div>
                          <div className="text-xs opacity-75">Single specialists</div>
                        </div>
                        <div className="text-xs bg-black/20 px-2 py-1 rounded-full">
                          {INDIVIDUAL_AGENTS.length}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                  {/* Search Bar */}
                  <div className="p-6 border-b border-hatchin-border-subtle">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                      <input
                        type="text"
                        placeholder={activeTab === 'teams' ? 'Search team templates...' : 'Search teammates...'}
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPackMessage(null); }}
                        className="w-full pl-10 pr-4 py-3 bg-hatchin-surface border border-hatchin-border-subtle rounded-xl text-hatchin-text-bright placeholder-muted-foreground focus:border-hatchin-blue focus:outline-none focus:ring-1 focus:ring-hatchin-blue transition-colors"
                      />
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="flex-1 p-6 overflow-y-auto">
                    {activeTab === 'teams' ? (
                      <>
                        {packMessage && (
                          <div
                            role="status"
                            className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
                          >
                            <span aria-hidden="true">⚠️</span>
                            <span>{packMessage}</span>
                          </div>
                        )}
                        <div
                          className="grid gap-4 grid-cols-3"
                          style={{
                            gridTemplateColumns: 'repeat(3, 1fr)'
                          }}
                        >
                        {filteredTeamTemplates.map((template) => (
                          <motion.div
                            key={template.id}
                            className="relative bg-gradient-to-br from-hatchin-surface-elevated to-hatchin-panel rounded-xl p-4 border border-hatchin-border-subtle transition-all duration-300 cursor-pointer flex flex-col hover:border-hatchin-blue/50 hover:shadow-[0_8px_30px_rgba(108,130,255,0.15)] group overflow-hidden"
                            onClick={() => handleUseTemplate(template)}
                            whileHover={{
                              y: -4,
                              scale: 1.02,
                              rotateY: 3,
                              rotateX: 2
                            }}
                            whileTap={{ scale: 0.97 }}
                            style={{ minHeight: '200px', transformStyle: 'preserve-3d' }}
                          >
                            {/* Glossy Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                            {/* Pack Header */}
                            <div className="relative z-10 flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hatchin-blue/20 to-hatchin-purple/20 border border-hatchin-blue/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(108,130,255,0.15)] group-hover:shadow-[0_0_25px_rgba(108,130,255,0.25)] transition-shadow">
                                  {template.icon}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-hatchin-text-bright text-sm mb-1 flex items-center gap-2">
                                    {template.name}
                                    {template.suggested && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="text-hatchin-blue"
                                      >
                                        <Sparkles size={10} />
                                      </motion.div>
                                    )}
                                  </h3>
                                  <p className="text-muted-foreground text-xs leading-tight">
                                    {template.description}
                                  </p>
                                </div>
                              </div>
                              <div className="ml-1 text-muted-foreground flex items-center gap-1">
                                <Users size={10} />
                                <span className="text-xs">{template.agents.length}</span>
                              </div>
                            </div>

                            {/* Team Preview - Compact */}
                            <div className="mt-2 mb-2">
                              <div className="flex flex-wrap gap-1">
                                {template.agents.map((agent, agentIndex) => (
                                  <div key={agentIndex} className="flex items-center gap-1 bg-hatchin-card rounded px-2 py-1">
                                    <User className="w-3 h-3 text-hatchin-blue" />
                                    <span className="text-xs text-hatchin-text-bright">{agent.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* CTA Button - Fixed at bottom */}
                            <div className="mt-auto pt-2">
                              <button className="w-full px-3 py-2 rounded-lg transition-all duration-200 text-xs font-medium bg-hatchin-border-subtle hover:bg-hatchin-blue text-hatchin-text-bright hover:text-white">
                                Use Pack
                              </button>
                            </div>
                          </motion.div>
                        ))}
                        </div>
                      </>
                    ) : (
                      <div
                        className="grid gap-4 grid-cols-3"
                        style={{
                          gridTemplateColumns: 'repeat(3, 1fr)'
                        }}
                      >
                        {filteredIndividualAgents.map((agent, index) => (
                          <motion.div
                            key={index}
                            className="relative bg-gradient-to-br from-hatchin-surface-elevated to-hatchin-panel rounded-xl p-4 border border-hatchin-border-subtle transition-all duration-300 cursor-pointer flex flex-col hover:border-hatchin-blue/50 hover:shadow-[0_8px_30px_rgba(108,130,255,0.15)] group overflow-hidden"
                            onClick={() => handleAddIndividualAgent(agent)}
                            whileHover={{
                              y: -4,
                              scale: 1.02,
                              rotateY: 3,
                              rotateX: 2
                            }}
                            whileTap={{ scale: 0.97 }}
                            style={{ minHeight: '200px', transformStyle: 'preserve-3d' }}
                          >
                            {/* Glossy Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                            {/* Pack Header */}
                            <div className="relative z-10 flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(108,130,255,0.1)] group-hover:shadow-[0_0_25px_rgba(108,130,255,0.25)] transition-shadow flex items-center justify-center bg-[var(--hatchin-surface)]">
                                  <AgentAvatar agentName={agent.name} role={agent.role} size={40} />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-hatchin-text-bright text-sm mb-1">{agent.name}</h3>
                                  <p className="text-muted-foreground text-xs leading-tight">{agent.role}</p>
                                </div>
                              </div>
                            </div>

                            {/* Description */}
                            <div className="mt-2 mb-2">
                              <p className="text-muted-foreground text-xs leading-tight">
                                {agent.description}
                              </p>
                            </div>

                            {/* CTA Button - Fixed at bottom */}
                            <div className="mt-auto pt-2">
                              <button
                                className="w-full px-3 py-2 rounded-lg transition-all duration-200 text-xs font-medium bg-hatchin-border-subtle hover:bg-hatchin-blue text-hatchin-text-bright hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddIndividualAgent(agent);
                                }}
                                data-testid={`button-add-individual-agent-${agent.role.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                Add Teammate
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* No results */}
                    {((activeTab === 'teams' && filteredTeamTemplates.length === 0) ||
                      (activeTab === 'individual' && filteredIndividualAgents.length === 0)) && (
                        <div className="text-center py-12">
                          <div className="text-hatchin-text-bright text-lg mb-2">No results found</div>
                          <p className="text-muted-foreground text-sm">
                            Try adjusting your search terms or browse all {activeTab === 'teams' ? 'templates' : 'agents'}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </FocusTrap>
      )}
    </AnimatePresence>
  );
}
