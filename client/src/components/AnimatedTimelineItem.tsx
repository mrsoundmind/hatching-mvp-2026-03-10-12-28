"use client"

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedTimelineItemProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  animation?: 'slideIn' | 'fadeIn' | 'scaleIn' | 'slideUp'
  isNew?: boolean
  isRecent?: boolean
  className?: string
  icon?: React.ReactNode
  timestamp?: string
  status?: 'success' | 'warning' | 'error' | 'info' | 'default'
}

export const AnimatedTimelineItem: React.FC<AnimatedTimelineItemProps> = ({
  children,
  delay = 0,
  duration = 300,
  animation = 'slideIn',
  isNew = false,
  isRecent = false,
  className = '',
  icon,
  timestamp,
  status = 'default'
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
      setIsAnimating(true)
      
      // Stop animation after duration
      setTimeout(() => {
        setIsAnimating(false)
      }, duration)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, duration])

  const statusClasses = {
    success: 'border-l-green-500 bg-green-50/10',
    warning: 'border-l-orange-500 bg-orange-50/10',
    error: 'border-l-red-500 bg-red-50/10',
    info: 'border-l-blue-500 bg-blue-50/10',
    default: 'border-l-gray-500 bg-gray-50/10'
  }

  const animationClasses = {
    slideIn: isVisible 
      ? 'translate-x-0 opacity-100' 
      : 'translate-x-[-100%] opacity-0',
    fadeIn: isVisible 
      ? 'opacity-100' 
      : 'opacity-0',
    scaleIn: isVisible 
      ? 'scale-100 opacity-100' 
      : 'scale-95 opacity-0',
    slideUp: isVisible 
      ? 'translate-y-0 opacity-100' 
      : 'translate-y-4 opacity-0'
  }

  return (
    <div
      ref={elementRef}
      className={cn(
        "relative border-l-2 pl-4 py-3 transition-all duration-300 ease-out",
        statusClasses[status],
        animationClasses[animation],
        isNew && "ring-2 ring-blue-500/20 bg-blue-50/20",
        isRecent && "animate-pulse",
        isAnimating && "transform-gpu",
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {/* Icon */}
      {icon && (
        <div className={cn(
          "absolute -left-2 top-3 w-4 h-4 rounded-full flex items-center justify-center",
          "bg-background border-2 border-current",
          status === 'success' && "text-green-500 border-green-500",
          status === 'warning' && "text-orange-500 border-orange-500",
          status === 'error' && "text-red-500 border-red-500",
          status === 'info' && "text-blue-500 border-blue-500",
          status === 'default' && "text-gray-500 border-gray-500"
        )}>
          {icon}
        </div>
      )}

      {/* Content */}
      <div className="space-y-1">
        {children}
        
        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-muted-foreground">
            {timestamp}
          </div>
        )}
      </div>

      {/* New item indicator */}
      {isNew && (
        <div className="absolute -right-1 -top-1 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
      )}

      {/* Recent activity pulse */}
      {isRecent && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-current opacity-50 animate-pulse" />
      )}
    </div>
  )
}

export default AnimatedTimelineItem
