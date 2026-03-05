import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Clock, User, Tag, Sparkles } from 'lucide-react';

interface ExtractedTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedAssignee: string | {
    id?: string;
    name?: string;
    role?: string;
  } | null;
  category: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  reasoning: string;
}

interface TaskApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: ExtractedTask[];
  onApproveTasks: (approvedTasks: ExtractedTask[]) => void;
  projectName: string;
}

export function TaskApprovalModal({
  isOpen,
  onClose,
  tasks,
  onApproveTasks,
  projectName
}: TaskApprovalModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [isApproving, setIsApproving] = useState(false);

  const handleTaskToggle = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((_, index) => index)));
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const approvedTasks = tasks.filter((_, index) => selectedTasks.has(index));
      await onApproveTasks(approvedTasks);
      setSelectedTasks(new Set());
      onClose();
    } catch (error) {
      console.error('Error approving tasks:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      default: return 'bg-[#43444B] text-[#A6A7AB]';
    }
  };

  const getEffortStyle = (effort: string) => {
    switch (effort) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-[#43444B] text-[#A6A7AB]';
    }
  };

  const getAssigneeLabel = (assignee: ExtractedTask['suggestedAssignee']) => {
    if (!assignee) return 'Unassigned';
    if (typeof assignee === 'string') return assignee;
    return assignee.name || assignee.role || 'Unassigned';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-[#23262B] border border-[#43444B] text-[#F1F1F3] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#F1F1F3]">
            <div className="w-8 h-8 bg-[#6C82FF]/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6C82FF]" />
            </div>
            AI Suggested Tasks for <span className="text-[#6C82FF]">{projectName}</span>
          </DialogTitle>
          <DialogDescription className="text-[#A6A7AB]">
            Approve the tasks you want to create in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header with select all */}
          <div className="flex items-center justify-between p-4 bg-[#1A1C1F] rounded-lg border border-[#43444B]">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedTasks.size === tasks.length
                    ? 'bg-[#6C82FF] border-[#6C82FF]'
                    : 'border-[#43444B] hover:border-[#6C82FF]'
                  }`}
              >
                {selectedTasks.size === tasks.length && (
                  <CheckCircle className="w-3 h-3 text-white" />
                )}
              </button>
              <span className="text-sm font-medium text-[#F1F1F3]">
                {selectedTasks.size} of {tasks.length} tasks selected
              </span>
            </div>
            <div className="text-sm text-[#A6A7AB]">
              Review and select tasks to create
            </div>
          </div>

          {/* Task list */}
          <div className="space-y-3">
            <AnimatePresence>
              {tasks.map((task, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleTaskToggle(index)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 ${selectedTasks.has(index)
                      ? 'border-[#6C82FF]/60 bg-[#6C82FF]/10'
                      : 'border-[#43444B] bg-[#2A2D33] hover:border-[#6C82FF]/30 hover:bg-[#6C82FF]/5'
                    }`}
                  whileTap={{ scale: 0.995 }}
                >
                  <div className="flex items-start gap-3">
                    {/* Custom Checkbox */}
                    <div
                      className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${selectedTasks.has(index)
                          ? 'bg-[#6C82FF] border-[#6C82FF]'
                          : 'border-[#43444B]'
                        }`}
                    >
                      {selectedTasks.has(index) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                          <CheckCircle className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#F1F1F3] mb-1">
                        {task.title}
                      </h3>
                      <p className="text-xs text-[#A6A7AB] mb-3 leading-relaxed">
                        {task.description}
                      </p>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityStyle(task.priority)}`}>
                          {task.priority.toUpperCase()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#43444B] text-[#A6A7AB] flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {getAssigneeLabel(task.suggestedAssignee)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#43444B] text-[#A6A7AB] flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />
                          {task.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getEffortStyle(task.estimatedEffort)}`}>
                          {task.estimatedEffort} effort
                        </span>
                      </div>

                      {/* AI Reasoning */}
                      <div className="text-xs text-[#A6A7AB] bg-[#1A1C1F] border border-[#43444B] p-2.5 rounded-lg">
                        <span className="text-[#6C82FF] font-medium">AI Reasoning: </span>
                        {task.reasoning}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#43444B]">
            <div className="text-sm text-[#A6A7AB]">
              {selectedTasks.size > 0 ? (
                <span className="text-[#F1F1F3]">
                  {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} will be created
                </span>
              ) : (
                'Select tasks to create them'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[#A6A7AB] hover:text-[#F1F1F3] rounded-lg hover:bg-[#37383B] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={selectedTasks.size === 0 || isApproving}
                className="px-4 py-2 text-sm bg-[#6C82FF] text-white rounded-lg hover:bg-[#6C82FF]/90 transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isApproving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Create {selectedTasks.size} Task{selectedTasks.size > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
