import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { buttonVariants } from './ui/button';
import { useTheme } from './ThemeProvider';
import { cn } from '../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-9 w-9 rounded-lg"
        )}
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border">
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 cursor-pointer ${theme === 'light' ? 'bg-primary/10 text-primary' : ''}`}
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'bg-primary/10 text-primary' : ''}`}
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 cursor-pointer ${theme === 'system' ? 'bg-primary/10 text-primary' : ''}`}
        >
          <Monitor className="h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
