import FocusTrap from 'focus-trap-react';
import { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface ProjectNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onConfirm: (name: string, description?: string) => void;
  templateName?: string;
  templateDescription?: string;
  isLoading?: boolean;
}

export default function ProjectNameModal({
  isOpen,
  onClose,
  onBack,
  onConfirm,
  templateName = '',
  templateDescription = '',
  isLoading = false
}: ProjectNameModalProps) {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Pre-fill with template data when modal opens
  useEffect(() => {
    if (isOpen && templateName) {
      setProjectName(templateName);
      setProjectDescription(templateDescription);
    }
  }, [isOpen, templateName, templateDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onConfirm(projectName.trim(), projectDescription.trim() || undefined);
    }
  };

  const isValid = projectName.trim().length > 0;

  if (!isOpen) return null;

  return (
    <FocusTrap active={isOpen}>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#23262B] rounded-2xl w-full max-w-md border border-[#43444B] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="modal-title">
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
                Name Your Project
              </h2>
              <p className="text-[#A6A7AB] text-sm">
                Customize your project name and description
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name Input */}
          <div>
            <label className="block text-[#F1F1F3] text-sm font-medium mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter your project name"
              className="w-full px-4 py-3 bg-[#37383B] border border-[#43444B] rounded-xl text-[#F1F1F3] placeholder-[#A6A7AB] focus:border-[#6C82FF] focus:outline-none focus:ring-1 focus:ring-[#6C82FF] transition-colors"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {/* Project Description Input */}
          <div>
            <label className="block text-[#F1F1F3] text-sm font-medium mb-2">
              Description (Optional)
            </label>
            <textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Briefly describe what you're building"
              rows={3}
              className="w-full px-4 py-3 bg-[#37383B] border border-[#43444B] rounded-xl text-[#F1F1F3] placeholder-[#A6A7AB] focus:border-[#6C82FF] focus:outline-none focus:ring-1 focus:ring-[#6C82FF] transition-colors resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onBack || onClose}
              className="flex-1 px-4 py-3 bg-[#37383B] text-[#F1F1F3] rounded-xl hover:bg-[#43444B] transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className={`flex-1 px-4 py-3 rounded-xl transition-colors font-medium ${
                isValid && !isLoading
                  ? 'bg-[#6C82FF] text-white hover:bg-[#5A6FE5]'
                  : 'bg-[#43444B] text-[#A6A7AB] cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </FocusTrap>
  );
}