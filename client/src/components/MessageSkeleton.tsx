import { Skeleton } from '@/components/ui/skeleton';

interface MessageSkeletonProps {
  isUser?: boolean;
  showSender?: boolean;
}

export function MessageSkeleton({ isUser = false, showSender = false }: MessageSkeletonProps) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mt-4`}>
      <div className={`max-w-[70%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
        {/* Sender info skeleton */}
        {showSender && !isUser && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        )}

        {/* Message bubble skeleton */}
        <div
          className={`p-3 rounded-lg ${
            isUser
              ? 'bg-purple-600/20 rounded-br-sm'
              : 'bg-gray-700/50 rounded-bl-sm border border-gray-600'
          }`}
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-16 mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}