import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Bell, Shield, Eye, Smartphone, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { signOut, auth } from '../lib/firebase';
import { toast } from 'sonner';

export default function Settings() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [privacy, setPrivacy] = useState(true);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and app settings.</p>
      </div>

      <div className="space-y-6">
        {/* Account Section */}
        <section className="bg-card rounded-[2rem] p-8 border border-border shadow-sm">
          <h2 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-foreground">
            <Smartphone className="w-5 h-5 text-primary" />
            Account Preferences
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-4 border-b border-border/50">
              <div>
                <p className="font-bold text-foreground">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive updates about your matches and teams.</p>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-primary' : 'bg-muted'}`}
              >
                <motion.div 
                  animate={{ x: notifications ? 26 : 2 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-border/50">
              <div>
                <p className="font-bold text-foreground">Profile Visibility</p>
                <p className="text-xs text-muted-foreground">Make your profile visible to other players in the network.</p>
              </div>
              <button 
                onClick={() => setPrivacy(!privacy)}
                className={`w-12 h-6 rounded-full transition-colors relative ${privacy ? 'bg-primary' : 'bg-muted'}`}
              >
                <motion.div 
                  animate={{ x: privacy ? 26 : 2 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-card rounded-[2rem] p-8 border border-border shadow-sm">
          <h2 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-emerald-500" />
            Security & Privacy
          </h2>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Your account is secured with Google Authentication. You can manage your personal data and account security directly through your Google Account settings.
            </p>
            <Button variant="outline" className="w-full h-12 rounded-xl text-xs font-black uppercase tracking-widest border-border text-foreground hover:bg-muted">
              View Privacy Policy
            </Button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-red-500/5 dark:bg-red-500/10 rounded-[2rem] p-8 border border-red-500/20">
          <h2 className="text-lg font-black uppercase tracking-tight mb-6 text-red-600 dark:text-red-400 flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            App Actions
          </h2>
          
          <div className="space-y-3">
            <Button 
              onClick={handleLogout}
              variant="destructive" 
              className="w-full h-12 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
            >
              Sign Out of Account
            </Button>
            <p className="text-[10px] text-center text-red-400 font-bold uppercase tracking-wider">
              Version 1.0.4 (Mobile Optimized)
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
