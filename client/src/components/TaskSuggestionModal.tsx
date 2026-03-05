import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { User, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface TaskSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  suggestedAssignee: {
    id: string;
    name: string;
    role: string; 
    avatar?: string;
  };
  category: string;
  estimatedEffort: string;
  reasoning: string;
}

interface TaskSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: TaskSuggestion[];
  onApproveTasks: (approvedTasks: TaskSuggestion[]) => void;
  onRejectAll: () => void;
}

const priorityColors = {
  High: 'bg-red-100 text-red-800 border-red-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low: 'bg-green-100 text-green-800 border-green-200'
};

const priorityIcons = {
  High: <AlertCircle className="w-4 h-4" />,
  Medium: <Calendar className="w-4 h-4" />,
  Low: <CheckCircle className="w-4 h-4" />
};

export function TaskSuggestionModal({
  isOpen,
  onClose,
  suggestions,
  onApproveTasks,
  onRejectAll
}: TaskSuggestionModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTaskToggle = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTasks.size === suggestions.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(suggestions.map(s => s.id)));
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    const approvedTasks = suggestions.filter(s => selectedTasks.has(s.id));
    await onApproveTasks(approvedTasks);
    setSelectedTasks(new Set());
    setIsProcessing(false);
    onClose();
  };

  const handleRejectAll = () => {
    setSelectedTasks(new Set());
    onRejectAll();
    onClose();
  };

  const allSelected = selectedTasks.size === suggestions.length;
  const someSelected = selectedTasks.size > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            AI Task Suggestions
            <Badge variant="secondary" className="ml-2">
              {suggestions.length} suggestions
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review suggested tasks and approve only the ones you want to create.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Actions */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                className="data-[state=checked]:bg-blue-600"
              />
              <span className="text-sm font-medium">
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {selectedTasks.size} of {suggestions.length} selected
            </div>
          </div>

          {/* Task Suggestions */}
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <Card 
                key={suggestion.id} 
                className={`transition-all duration-200 ${
                  selectedTasks.has(suggestion.id) 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'hover:shadow-md'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedTasks.has(suggestion.id)}
                        onCheckedChange={() => handleTaskToggle(suggestion.id)}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          {suggestion.title}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {suggestion.description}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      className={`${priorityColors[suggestion.priority]} flex items-center gap-1`}
                    >
                      {priorityIcons[suggestion.priority]}
                      {suggestion.priority}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assignee Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{suggestion.suggestedAssignee.name}</div>
                        <div className="text-xs text-gray-500">{suggestion.suggestedAssignee.role}</div>
                      </div>
                    </div>

                    {/* Category & Effort */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.category}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {suggestion.estimatedEffort}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-purple-600">AI</span>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Why this task?</div>
                        <p className="text-xs text-gray-600">{suggestion.reasoning}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleRejectAll}
              className="text-gray-600 hover:text-gray-800"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject All
            </Button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {selectedTasks.size} tasks selected
              </span>
              <Button
                onClick={handleApprove}
                disabled={selectedTasks.size === 0 || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating Tasks...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Selected Tasks ({selectedTasks.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
