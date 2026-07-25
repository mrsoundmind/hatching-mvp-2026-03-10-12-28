import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface DocumentUploadZoneProps {
  projectId: string;
  onUploadComplete: () => void;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
const MAX_BYTES = 10 * 1024 * 1024;

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export function DocumentUploadZone({ projectId, onUploadComplete }: DocumentUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFilename, setUploadingFilename] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Only PDF, DOCX, TXT, and MD files are supported');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File must be under 10MB');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadingFilename(file.name);

    try {
      const form = new FormData();
      form.append('document', file);
      const res = await fetch(`/api/projects/${projectId}/brain/upload`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        throw new Error('server');
      }
      onUploadComplete();
      setIsUploading(false);
      setUploadingFilename('');
    } catch {
      setError("Couldn't upload that file. Try again.");
      setIsUploading(false);
      setUploadingFilename('');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleClick = () => {
    if (!isUploading) inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
      // Reset input so same file can be re-uploaded
      e.target.value = '';
    }
  };

  const borderClass = error
    ? 'border-2 border-solid border-destructive'
    : isDragging
      ? 'border-2 border-solid border-[var(--hatchin-blue)] bg-[var(--hatchin-blue)]/5'
      : 'border-2 border-dashed border-[var(--hatchin-border-subtle)] hover:border-[var(--hatchin-blue)]/50';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload document — drag and drop or click to browse"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center min-h-[80px] px-4 py-3 rounded-xl cursor-pointer select-none bg-[var(--hatchin-surface)] transition-colors duration-150 ${borderClass}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={handleInputChange}
        tabIndex={-1}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-1">
          <Loader2 className="w-4 h-4 text-[var(--hatchin-text-muted)] animate-spin" />
          <span className="text-xs text-[var(--hatchin-text-muted)] truncate max-w-[200px]">
            {uploadingFilename}
          </span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-1">
          <Upload className="w-5 h-5 text-[var(--hatchin-text-muted)]" />
          <span className="text-xs text-destructive text-center">{error}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <Upload className="w-5 h-5 text-[var(--hatchin-text-muted)]" />
          <span className="text-xs text-[var(--hatchin-text-muted)]">
            Drop a file here or{' '}
            <span className="text-[var(--hatchin-blue)]">browse</span>
          </span>
          <span className="text-micro text-[var(--hatchin-text-muted)]">
            PDF, DOCX, TXT, MD — up to 10MB
          </span>
        </div>
      )}
    </div>
  );
}
