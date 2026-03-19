import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Brain, Lightbulb, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Agent, Message } from "@shared/schema";
import { useWebSocket, getWebSocketUrl } from "@/lib/websocket";
import { useAuth } from "@/hooks/useAuth";

interface MayaChatProps {
  projectId: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'maya';
  timestamp: string;
  isStreaming?: boolean;
}

export function MayaChat({ projectId }: MayaChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showCoachmark, setShowCoachmark] = useState(false);

  // First-time user coachmark: pulse ring on chat input for 10 seconds
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('hatchin_maya_visited');
    if (!hasOnboarded) {
      setShowCoachmark(true);
      const timer = setTimeout(() => {
        setShowCoachmark(false);
        localStorage.setItem('hatchin_maya_visited', 'true');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  const conversationId = `project:${projectId}`;


  // Fetch project data
  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  // Fetch Maya agent
  const { data: agents, isLoading: isAgentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const mayaAgent = agents?.find(agent =>
    agent.projectId === projectId &&
    agent.isSpecialAgent &&
    agent.name === "Maya"
  );

  // Fetch initial messages from API
  const { data: apiMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    enabled: !!conversationId,
  });

  // Streaming State
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamWatchdogRef = useRef<number | null>(null);

  const clearStreamWatchdog = () => {
    if (streamWatchdogRef.current) {
      window.clearTimeout(streamWatchdogRef.current);
      streamWatchdogRef.current = null;
    }
  };

  const resetStreamWatchdog = () => {
    clearStreamWatchdog();
    streamWatchdogRef.current = window.setTimeout(() => {
      setIsStreaming(false);
      setStreamingMessageId(null);
      setStreamingContent("");
    }, 20000);
  };

  // Add Document State
  const queryClient = useQueryClient();
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");

  const addDocumentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/brain/documents`, {
        title: newDocTitle,
        content: newDocContent,
        type: "idea-development"
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setIsAddDocOpen(false);
      setNewDocTitle("");
      setNewDocContent("");
    }
  });

  // Load existing messages 
  useEffect(() => {
    if (apiMessages) {
      const formatted = apiMessages.map(m => ({
        id: m.id,
        content: m.content || '',
        sender: (m.messageType === 'user' ? 'user' : 'maya') as 'user' | 'maya',
        timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString()
      }));
      setMessages(formatted);
    }
  }, [apiMessages]);

  const webSocketUrl = useMemo(() => {
    const url = getWebSocketUrl();
    if (!url || url.includes(':undefined') || url.trim() === '') {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws`;
    }
    return url;
  }, []);

  const { socket, sendMessage: sendWebSocketMessage } = useWebSocket(webSocketUrl, {
    onMessage: (msg) => {
      // 1. New fully formed message
      if (msg.type === 'new_message' && msg.message.conversationId === conversationId) {
        clearStreamWatchdog();
        setMessages(prev => {
          if (prev.find(m => m.id === msg.message.id)) return prev;
          return [...prev, {
            id: msg.message.id,
            content: msg.message.content,
            sender: msg.message.messageType === 'user' ? 'user' : 'maya',
            timestamp: msg.message.timestamp || new Date().toISOString()
          }];
        });
      }
      // 2. Streaming chunk updates
      else if (msg.type === 'streaming_chunk' && msg.messageId === streamingMessageId) {
        resetStreamWatchdog();
        setStreamingContent(msg.accumulatedContent);
      }
      else if (msg.type === 'token') {
        resetStreamWatchdog();
        setStreamingContent(prev => prev + (msg.content || ''));
      }
      // 3. Streaming lifecycle
      else if (msg.type === 'streaming_started') {
        setIsStreaming(true);
        setStreamingContent('');
        setStreamingMessageId(msg.messageId);
        resetStreamWatchdog();
      }
      else if (msg.type === 'streaming_completed') {
        clearStreamWatchdog();
        setIsStreaming(false);
        if (msg.message) {
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== msg.messageId);
            return [...filtered, {
              id: msg.message.id,
              content: msg.message.content,
              sender: 'maya',
              timestamp: msg.message.timestamp || new Date().toISOString()
            }];
          });
        }
        setStreamingMessageId(null);
        setStreamingContent("");
      }
      // Assistant fixed message
      else if (msg.type === 'assistant_message' && msg.message) {
        clearStreamWatchdog();
        setIsStreaming(false);
        setStreamingMessageId(null);
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== msg.messageId);
          return [...filtered, {
            id: msg.message.id,
            content: msg.message.content,
            sender: 'maya',
            timestamp: new Date().toISOString()
          }];
        });
      }
      else if (msg.type === 'streaming_error' || msg.type === 'error') {
        clearStreamWatchdog();
        setIsStreaming(false);
        setStreamingMessageId(null);
        setStreamingContent("");
      }
    },
    onConnect: (ws) => {
      ws.send(JSON.stringify({
        type: 'join_conversation',
        conversationId
      }));
    },
    onDisconnect: () => {
      clearStreamWatchdog();
      setIsStreaming(false);
      setStreamingMessageId(null);
      setStreamingContent("");
    },
    onError: () => {
      clearStreamWatchdog();
      setIsStreaming(false);
      setStreamingMessageId(null);
      setStreamingContent("");
    }
  });

  // Inject greeting if totally empty and loaded
  useEffect(() => {
    if (mayaAgent && messages.length === 0 && apiMessages && apiMessages.length === 0) {
      setMessages([{
        id: "welcome",
        content: mayaAgent.personality?.welcomeMessage || "Hi! I'm Maya, your AI idea partner. Let's develop your idea together!",
        sender: 'maya',
        timestamp: new Date().toISOString()
      }]);
    }
  }, [mayaAgent, messages.length, apiMessages]);

  const sendMessage = () => {
    if (!message.trim() || socket?.readyState !== WebSocket.OPEN) return;

    const tempId = `temp-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: tempId,
      content: message,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");

    sendWebSocketMessage({
      type: 'send_message_streaming',
      conversationId,
      message: {
        conversationId,
        content: userMessage.content,
        messageType: 'user',
        userId: user?.id || 'anonymous',
      }
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    return () => clearStreamWatchdog();
  }, []);

  if (isProjectLoading || isAgentsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Maya...</p>
        </div>
      </div>
    );
  }

  if (!project || !mayaAgent) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 px-4 text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-6">
          <span className="text-3xl">🤖</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Maya is Not Available for this Project</h2>
        <p className="text-gray-400 max-w-md mb-8">
          The Maya PM Agent is exclusively available for "Idea" projects to help you brainstorm and develop concepts.
        </p>
        <Button onClick={() => setLocation('/')} className="bg-purple-600 hover:bg-purple-700">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Projects
              </Button>
              <div className="h-6 w-px bg-gray-700"></div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-sm">🤖</span>
                </div>
                <div>
                  <h1 className="text-white font-semibold">Chat with Maya</h1>
                  <p className="text-sm text-gray-400">{project.name} • AI Idea Partner</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-purple-900/50 text-purple-300">
                <Brain className="w-3 h-3 mr-1" />
                Idea Development
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-gray-800 border-gray-700 h-[600px] flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div>
                    <CardTitle className="text-white">Maya</CardTitle>
                    <p className="text-sm text-gray-400">AI Idea Partner • Online</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                        }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {isStreaming && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="max-w-[80%] p-3 rounded-lg bg-gray-700 text-gray-100">
                        <p className="text-sm whitespace-pre-wrap">
                          {streamingContent}
                          <span className="ml-1 inline-block w-1.5 h-4 bg-purple-400 animate-pulse align-middle" />
                        </p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date().toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className={`flex space-x-2 rounded-xl transition-all duration-300 ${showCoachmark ? 'coachmark-ring ring-2 ring-hatchin-blue/60' : ''}`}>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your idea with Maya..."
                    className="flex-1 bg-[#2A2D33] border-[#43444B] text-[#F1F1F3] placeholder-[#A6A7AB] focus:ring-hatchin-blue focus:border-hatchin-blue"
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!message.trim() || socket?.readyState !== WebSocket.OPEN}
                    className="bg-hatchin-blue hover:bg-hatchin-blue/90"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700 h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b border-gray-700 flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center text-lg">
                  <Brain className="w-5 h-5 mr-2 text-purple-400" />
                  Project Brain
                </CardTitle>

                <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-900/40">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add to Project Brain</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Manually insert context, goals, or notes into your project's shared memory so your AI agents can access it.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Document Title</label>
                        <Input
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          placeholder="e.g., Target Audience Guidelines"
                          className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Content</label>
                        <Textarea
                          value={newDocContent}
                          onChange={(e) => setNewDocContent(e.target.value)}
                          placeholder="Enter the key information here..."
                          className="min-h-[150px] bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setIsAddDocOpen(false)} className="text-gray-400">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addDocumentMutation.mutate()}
                        disabled={!newDocTitle.trim() || !newDocContent.trim() || addDocumentMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {addDocumentMutation.isPending ? "Adding..." : "Add to Brain"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pt-4 space-y-4">
                {(!project?.brain?.documents || project.brain.documents.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-10">
                    <div className="w-12 h-12 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="text-gray-300 font-medium mb-1">Maya's Memory</h3>
                      <p className="text-xs text-gray-500 max-w-[200px] mb-4">
                        As you chat with Maya, she'll automatically build a memory of your project here.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 mr-auto ml-auto"
                        onClick={() => setIsAddDocOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Context Manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Saved Context</h4>
                    {project.brain.documents.map((doc: any) => (
                      <div key={doc.id} className="p-3 bg-gray-700 border border-gray-600 shadow-sm rounded-lg hover:border-gray-500 transition-colors">
                        <div className="flex items-start space-x-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="text-sm font-medium text-white line-clamp-1">{doc.title}</h4>
                            <p className="text-xs text-gray-400 line-clamp-3 mt-1 leading-relaxed">{doc.content}</p>
                            <span className="text-[10px] text-gray-500 mt-2 block">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="pt-4 mt-6 border-t border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Automated Memory</h4>
                  <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-xs text-gray-400 leading-relaxed italic">
                      {project?.brain?.sharedMemory || "Maya will automatically extract key decisions from your chats and store them here as shared memory for the team."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
