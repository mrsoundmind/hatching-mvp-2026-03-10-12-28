import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Testimonial {
  id: string;
  quote: string;
  author: {
    name: string;
    title?: string;
    avatar?: string;
    initials?: string;
  };
  company?: {
    name: string;
    logo?: string;
  };
}

interface TestimonialShowcaseProps {
  testimonials: Testimonial[];
  className?: string;
  defaultTestimonialId?: string;
  autoPlayInterval?: number;
}

export const TestimonialShowcase: React.FC<TestimonialShowcaseProps> = ({
  testimonials,
  className,
  defaultTestimonialId,
  autoPlayInterval = 4000,
}) => {
  const initialIndex = testimonials.findIndex(t => t.id === defaultTestimonialId);
  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const activeTestimonial = testimonials[activeIndex];

  const switchTestimonial = (newIndex: number) => {
    if (newIndex === activeIndex || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActiveIndex(newIndex);
      setTimeout(() => setIsAnimating(false), 100);
    }, 200);
  };

  useEffect(() => {
    if (!isHovered) {
      autoPlayRef.current = setInterval(() => {
        switchTestimonial((activeIndex + 1) % testimonials.length);
      }, autoPlayInterval);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isHovered, autoPlayInterval, testimonials.length]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleCardClick = () => {
    switchTestimonial((activeIndex + 1) % testimonials.length);
  };

  return (
    <div className={cn('w-full select-none max-w-4xl mx-auto space-y-8', className)}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm transition-all duration-700 hover:border-yellow-400/60 cursor-pointer"
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(251, 191, 36, 0.15), transparent 40%)`,
          }}
        />
        <div className="relative z-10 p-8 md:p-12 aspect-video transition-colors duration-300 rounded-2xl flex flex-col justify-center">
          <q
            className={cn(
              'text-3xl md:text-5xl lg:text-6xl font-medium leading-11 md:leading-relaxed tracking-wide text-center text-white mt-auto transition-all duration-500',
              isAnimating ? 'blur-sm opacity-0 translate-y-4' : 'blur-0 opacity-100 translate-y-0'
            )}
          >
            {activeTestimonial.quote}
          </q>
          <div
            className={cn(
              'flex items-center mt-auto justify-between transition-all duration-500',
              isAnimating ? 'blur-sm opacity-0 translate-y-4' : 'blur-0 opacity-100 translate-y-0'
            )}
          >
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20 rounded-lg shadow-xs shadow-white/50 transition-all duration-300 group-hover:border-yellow-400/40">
                <AvatarImage src={activeTestimonial.author.avatar} alt={activeTestimonial.author.name} />
                <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
                  {activeTestimonial.author.initials ||
                    activeTestimonial.author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-white text-lg">{activeTestimonial.author.name}</div>
                {activeTestimonial.author.title && (
                  <div className="text-sm text-white/60 uppercase tracking-wider">
                    {activeTestimonial.author.title}
                  </div>
                )}
              </div>
            </div>
            {activeTestimonial.company && (
              <div className="flex items-center gap-2 opacity-70 transition-opacity duration-300 group-hover:opacity-100">
                {activeTestimonial.company.logo ? (
                  <img
                    src={activeTestimonial.company.logo}
                    alt={activeTestimonial.company.name}
                    className="h-8 w-auto"
                  />
                ) : (
                  <div className="text-lg font-bold text-foreground/70 tracking-wider">
                    {activeTestimonial.company.name}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap justify-center gap-2 md:gap-4">
          {testimonials.map((testimonial, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={testimonial.id}
                onClick={() => switchTestimonial(index)}
                className={cn(
                  'w-12 h-12 md:w-14 md:h-14 transition-all duration-300 hover:scale-110 hover:z-10 relative group/avatar',
                  isActive && 'scale-110 z-10'
                )}
              >
                <Avatar
                  className={cn(
                    'h-full w-full shadow-xs shadow-white/50 border rounded-none transition-all duration-300',
                    isActive
                      ? 'border-yellow-400 shadow-lg shadow-yellow-400/25'
                      : 'border-border/20 hover:border-yellow-400/40'
                  )}
                >
                  <AvatarImage src={testimonial.author.avatar} alt={testimonial.author.name} />
                  <AvatarFallback className="bg-muted text-[10px] font-medium">
                    {testimonial.author.initials ||
                      testimonial.author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 border shadow-lg">
                  {testimonial.author.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
