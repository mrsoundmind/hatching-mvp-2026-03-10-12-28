import { devLog } from '@/lib/devLog';
import { useState, useMemo } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, Search, Users, User, Sparkles, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Project, Agent } from '@shared/schema';
import AgentAvatar from '@/components/avatars/AgentAvatar';
import './starter-pack/biab.css';

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
  },
  {
    name: 'Juhi',
    role: 'Finance Analyst',
    color: 'emerald',
    initials: 'FA',
    description: 'Runs the numbers on runway, unit economics, and pricing, turning strategy into a defensible model and back into decisions.',
    expertise: ['Unit Economics', 'FP&A', 'Financial Modeling']
  },
  {
    name: 'Ira',
    role: 'Legal Counsel',
    color: 'slate',
    initials: 'LC',
    description: 'Protects the business without being the department of no: contracts, IP, privacy, and compliance in plain risk terms.',
    expertise: ['Contracts', 'IP & Compliance', 'Risk & Privacy']
  },
  {
    name: 'Dana',
    role: 'Sales Lead',
    color: 'rose',
    initials: 'SL',
    description: 'Runs a consultative sales motion: qualifies hard, discovers real pain, quantifies value, and turns pipeline into revenue.',
    expertise: ['Pipeline', 'Discovery & Qualification', 'Closing']
  },
  {
    name: 'Tess',
    role: 'Customer Success Manager',
    color: 'teal',
    initials: 'CS',
    description: 'Drives onboarding, adoption, and retention so customers reach value fast and stay, turning churn risk into expansion.',
    expertise: ['Onboarding', 'Retention', 'Churn Reduction']
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
        <FocusTrap active={isOpen} focusTrapOptions={{ fallbackFocus: '#biab-hatch-modal', escapeDeactivates: false, clickOutsideDeactivates: false }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,.5)' }}
          >
            <motion.div
              id="biab-hatch-modal"
              tabIndex={-1}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.15 }}
              className="biab"
              role="dialog" aria-modal="true" aria-label="Add a teammate"
              style={{ position: 'relative', width: 1160, maxWidth: '100%', height: 680, maxHeight: '90vh', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', outline: 'none' }}
            >
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div className="biab-jh2" style={{ fontSize: 18 }}>Add a teammate</div>
                  <div className="biab-jsub">Add AI teammates to {activeProject?.name || 'your project'}</div>
                </div>
                <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: 6, display: 'grid', placeItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Body: categories + main */}
              <div className="biab-lib">
                <div className="biab-cats">
                  <h4>Add</h4>
                  <button className={`biab-cat${activeTab === 'teams' ? ' on' : ''}`} onClick={() => { setActiveTab('teams'); setPackMessage(null); }}>
                    <Users size={16} /> <span style={{ flex: 1 }}>Teams</span> <span className="c">{TEAM_TEMPLATES.length}</span>
                  </button>
                  <button className={`biab-cat${activeTab === 'individual' ? ' on' : ''}`} onClick={() => { setActiveTab('individual'); setPackMessage(null); }}>
                    <User size={16} /> <span style={{ flex: 1 }}>Individual</span> <span className="c">{INDIVIDUAL_AGENTS.length}</span>
                  </button>
                </div>

                <div className="biab-libmain">
                  {/* Search */}
                  <div style={{ position: 'relative', marginBottom: 18 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
                    <input
                      type="text"
                      placeholder={activeTab === 'teams' ? 'Search team templates…' : 'Search teammates…'}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setPackMessage(null); }}
                      style={{ width: '100%', padding: '10px 14px 10px 34px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  {packMessage && (
                    <div role="status" style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', borderRadius: 10, border: '1px solid var(--amber-line)', background: 'var(--amber-tint)', padding: '10px 13px', fontSize: 12.5, color: 'var(--amber)' }}>
                      <span>{packMessage}</span>
                    </div>
                  )}

                  {activeTab === 'teams' ? (
                    <div className="biab-grid">
                      {filteredTeamTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="biab-pcard live"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleUseTemplate(template)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUseTemplate(template); } }}
                        >
                          <div className="ptop">
                            <span className="biab-etile" style={{ width: 40, height: 40, background: 'rgba(108,130,255,.14)', fontSize: 20 }} aria-hidden>{template.icon}</span>
                            <span className="biab-chip" style={{ background: 'var(--panel-3)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}><Users size={11} /> {template.agents.length}</span>
                          </div>
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {template.name}
                            {template.suggested && <Sparkles size={12} style={{ color: 'var(--blue)' }} />}
                          </h3>
                          <p className="one">{template.description}</p>
                          <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
                            {template.agents.map((agent, i) => (
                              <AgentAvatar key={i} characterName={agent.name} role={agent.role} size={24} />
                            ))}
                          </div>
                          <span className="cta">Use this team <ChevronRight size={13} /></span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="biab-grid">
                      {filteredIndividualAgents.map((agent, index) => (
                        <div
                          key={index}
                          className="biab-pcard live"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleAddIndividualAgent(agent)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddIndividualAgent(agent); } }}
                          data-testid={`button-add-individual-agent-${agent.role.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <div className="ptop">
                            <AgentAvatar agentName={agent.name} role={agent.role} size={40} />
                          </div>
                          <h3>{agent.name}</h3>
                          <div style={{ fontSize: 11.5, color: 'var(--blue)', fontWeight: 600, marginTop: 2 }}>{agent.role}</div>
                          <p className="one">{agent.description}</p>
                          <span className="cta">Add teammate <ChevronRight size={13} /></span>
                        </div>
                      ))}
                    </div>
                  )}

                  {((activeTab === 'teams' && filteredTeamTemplates.length === 0) ||
                    (activeTab === 'individual' && filteredIndividualAgents.length === 0)) && (
                      <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ color: 'var(--ink)', fontSize: 16, marginBottom: 6, fontWeight: 600 }}>No results found</div>
                        <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>
                          Try a different search, or browse all {activeTab === 'teams' ? 'teams' : 'teammates'}.
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </FocusTrap>
      )}
    </AnimatePresence>
  );
}
