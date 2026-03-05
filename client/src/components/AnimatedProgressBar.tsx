"use client"

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedProgressBarProps {
  value: number
  max?: number
  duration?: number
  showPercentage?: boolean
  showLabel?: boolean
  label?: string
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  barClassName?: string
  labelClassName?: string
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  value,
  max = 100,
  duration = 500,
  showPercentage = true,
  showLabel = true,
  label,
  color = 'default',
  size = 'md',
  className = '',
  barClassName = '',
  labelClassName = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number>()
  const previousValue = useRef(0)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = Math.min(Math.max(value, 0), max)
    const change = endValue - startValue
    
    if (change === 0) return

    setIsAnimating(true)
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)
      const currentValue = startValue + (endValue - startValue) * easeOutCubic
      
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
        previousValue.current = endValue
        setIsAnimating(false)
      }
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, max, duration])

  const percentage = Math.round((displayValue / max) * 100)
  
  const colorClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-orange-500',
    danger: 'bg-red-500',
    info: 'bg-cyan-500'
  }

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  return (
    <div className={cn("w-full", className)}>
      {showLabel && label && (
        <div className={cn("flex justify-between items-center mb-2", labelClassName)}>
          <span className="text-sm font-medium text-foreground">{label}</span>
          {showPercentage && (
            <span className="text-sm text-muted-foreground">
              {percentage}%
            </span>
          )}
        </div>
      )}
      
      <div className={cn(
        "w-full bg-secondary rounded-full overflow-hidden transition-all duration-200",
        sizeClasses[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-200 ease-out rounded-full",
            colorClasses[color],
            isAnimating && "animate-pulse",
            barClassName
          )}
          style={{
            width: `${Math.min(Math.max((displayValue / max) * 100, 0), 100)}%`,
            transition: isAnimating ? 'none' : 'width 0.3s ease-out'
          }}
        />
      </div>
      
      {!showLabel && showPercentage && (
        <div className="mt-1 text-right">
          <span className="text-xs text-muted-foreground">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  )
}

export default AnimatedProgressBar
