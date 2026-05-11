import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X, Trophy, Users, MapPin, Zap, LayoutDashboard, User } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../hooks/useAuth';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  id: string;
}

const steps: Step[] = [
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'Get a bird\'s eye view of your stats, upcoming matches, and profile completion progress.',
    icon: <LayoutDashboard className="w-8 h-8 text-indigo-500" />
  },
  {
    id: 'runs',
    title: 'Match-Making',
    description: 'Connect with local teams and schedule friendly matches at your favorite courts.',
    icon: <Zap className="w-8 h-8 text-amber-500" />
  },
  {
    id: 'courts',
    title: 'Nearby Courts',
    description: 'Discover the best volleyball courts in Tamil Nadu. Filter by surface, facility, and rating.',
    icon: <MapPin className="w-8 h-8 text-emerald-500" />
  },
  {
    id: 'players',
    title: 'Player Network',
    description: 'Connect with other volleyball enthusiasts. View skills, level up, and build your reputation.',
    icon: <User className="w-8 h-8 text-blue-500" />
  },
  {
    id: 'teams',
    title: 'Squads & Teams',
    description: 'Create or join a team. Challenge other squads and climb the rankings together.',
    icon: <Users className="w-8 h-8 text-purple-500" />
  },
  {
    id: 'tournaments',
    title: 'Tournaments',
    description: 'Register for upcoming regional tournaments and showcase your skills on the big stage.',
    icon: <Trophy className="w-8 h-8 text-orange-500" />
  }
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const hasSeenTour = localStorage.getItem(`hasSeenOnboarding_${user.uid}`);
    if (!hasSeenTour) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(`hasSeenOnboarding_${user.uid}`, 'true');
    }
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-100"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 flex">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-full transition-all duration-300 ${
                    idx <= currentStep ? 'bg-primary' : 'bg-transparent'
                  }`}
                  style={{ width: `${100 / steps.length}%` }}
                />
              ))}
            </div>

            <button 
              onClick={handleComplete}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 sm:p-10 text-center flex flex-col items-center">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, rotate: -10, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-8 shadow-inner"
              >
                {steps[currentStep].icon}
              </motion.div>

              <motion.div
                key={`text-${currentStep}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  {steps[currentStep].title}
                </h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
                  {steps[currentStep].description}
                </p>
              </motion.div>

              <div className="flex items-center gap-3 w-full mt-10">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    onClick={handlePrev}
                    className="flex-1 h-12 rounded-xl font-bold text-slate-400 uppercase tracking-widest text-[10px]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="flex-[2] h-12 rounded-xl font-black shadow-lg shadow-primary/20 uppercase tracking-widest text-xs"
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next Step'}
                  {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
              
              <div className="mt-4 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                {currentStep + 1} of {steps.length}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
