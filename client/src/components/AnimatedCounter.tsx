"use client"

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedCounterProps {
  value: number
  duration?: number
  showChange?: boolean
  prefix?: string
  suffix?: string
  className?: string
  changeClassName?: string
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 500,
  showChange = true,
  prefix = '',
  suffix = '',
  className = '',
  changeClassName = ''
}) => {
  const [displayValue, setDisplayValue] = useState(value)
  const [changeIndicator, setChangeIndicator] = useState<{
    value: number
    type: 'increase' | 'decrease' | null
  }>({ value: 0, type: null })
  
  const previousValue = useRef(value)
  const animationRef = useRef<number>()

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const change = endValue - startValue
    
    // Set change indicator
    if (change !== 0) {
      setChangeIndicator({
        value: Math.abs(change),
        type: change > 0 ? 'increase' : 'decrease'
      })
      
      // Clear change indicator after animation
      setTimeout(() => {
        setChangeIndicator({ value: 0, type: null })
      }, duration + 1000)
    }

    // Animate the counter
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutCubic)
      
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
        previousValue.current = endValue
      }
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration])

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="font-semibold text-foreground">
        {prefix}{formatNumber(displayValue)}{suffix}
      </span>
      
      {showChange && changeIndicator.type && (
        <span
          className={cn(
            "text-sm font-medium transition-all duration-300",
            changeIndicator.type === 'increase' 
              ? "text-green-500" 
              : "text-red-500",
            changeClassName
          )}
        >
          {changeIndicator.type === 'increase' ? '+' : '-'}{changeIndicator.value}
        </span>
      )}
    </div>
  )
}

export default AnimatedCounter
