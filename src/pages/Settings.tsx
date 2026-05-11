import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  deleteDoc, 
  doc, 
  writeBatch,
  query,
  where 
} from 'firebase/firestore';
import { Settings as SettingsIcon, Bell, Shield, Eye, Smartphone, LogOut, CheckCircle2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { signOut, auth } from '../lib/firebase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Settings() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [privacy, setPrivacy] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleRequestPush = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setPushEnabled(true);
      toast.success('Browser notifications activated!');
    } else {
      toast.error('Notification permission denied');
    }
  };

  const sendTestNotification = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'Test Notification',
        message: 'This is a test to verify your notification system is working!',
        type: 'success',
        createdAt: serverTimestamp()
      });
      toast.success('Test notification sent to your center!');
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleMasterReset = async () => {
    if (!user || user.email !== 'volleyballapp06@gmail.com') {
      toast.error('Unauthorized action');
      return;
    }

    setIsResetting(true);
    try {
      const collectionsToClear = [
        'tournaments',
        'courts',
        'matches',
        'teams',
        'teamChallenges',
        'usernames',
        'notifications',
        'tournament_inquiries',
        'tournament_registrations',
        'court_ratings',
        'brackets',
        'connection_requests',
        'lobbies'
      ];

      // 1. Clear simple collections
      for (const collName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleared collection: ${collName}`);
      }

      // 2. Clear users EXCEPT admin
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userBatch = writeBatch(db);
      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.email !== 'volleyballapp06@gmail.com') {
          userBatch.delete(doc.ref);
        }
      });
      await userBatch.commit();
      
      toast.success('App data reset successfully! Logins still exist in Auth but profiles are cleared.');
    } catch (error) {
      console.error('Master reset failed:', error);
      toast.error('Reset failed. Check console for details.');
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and app settings.</p>
      </div>

      <div className="space-y-6">
        {/* Notifications Section */}
        <section className="bg-card rounded-[2rem] p-8 border border-border shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700">
            <Bell className="w-32 h-32 text-primary" />
          </div>

          <h2 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-foreground relative z-10">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </h2>
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/50">
              <div className="flex-1">
                <p className="font-bold text-foreground">Browser Notifications</p>
                <p className="text-xs text-muted-foreground">Get real-time alerts even when the app is in the background.</p>
              </div>
              <Button 
                onClick={handleRequestPush}
                disabled={pushEnabled}
                className={cn(
                  "rounded-xl font-bold text-[10px] uppercase tracking-widest px-4",
                  pushEnabled ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-primary text-white"
                )}
                variant={pushEnabled ? "outline" : "default"}
              >
                {pushEnabled ? <><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Active</> : 'Activate'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
                 <div>
                   <p className="font-bold text-[13px] text-foreground">In-App Alerts</p>
                   <p className="text-[11px] text-muted-foreground">Toggle all notifications in the top bell icon.</p>
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

               <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-3">
                 <div>
                   <p className="font-bold text-[13px] text-primary">System Refresh</p>
                   <p className="text-[11px] text-primary/60">Test if your notifications are delivering correctly.</p>
                 </div>
                 <Button 
                  onClick={sendTestNotification}
                  size="sm" 
                  className="w-full rounded-xl bg-primary text-white font-bold h-9 text-[10px] uppercase tracking-widest"
                 >
                   <span style={{ color: '#0c0b0b' }}>Send Test </span>
                   <span style={{ color: '#0be89c' }}>Alert</span>
                 </Button>
               </div>
            </div>
          </div>
        </section>

        {/* Account Section */}
        <section className="bg-card rounded-[2rem] p-8 border border-border shadow-sm">
          <h2 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-foreground">
            <Smartphone className="w-5 h-5 text-primary" />
            Privacy Preferences
          </h2>
          
          <div className="space-y-4">
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
            Security & Data
          </h2>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Your account is secured with Google Authentication. You can manage your personal data and account security directly through your Google Account settings.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-border text-foreground hover:bg-muted">
                Terms of Service
              </Button>
              <Button variant="outline" className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-border text-foreground hover:bg-muted">
                Privacy Policy
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-red-500/5 dark:bg-red-500/10 rounded-[2rem] p-8 border border-red-500/20">
          <h2 className="text-lg font-black uppercase tracking-tight mb-6 text-red-600 dark:text-red-400 flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            Danger Zone
          </h2>
          
          <div className="space-y-4">
            <Button 
              onClick={handleLogout}
              variant="destructive" 
              className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
            >
              Sign Out of Account
            </Button>

            {user?.email === 'volleyballapp06@gmail.com' && (
              <div className="pt-4 border-t border-red-500/10">
                <p className="text-[10px] text-red-500/60 font-black uppercase tracking-widest mb-3">Admin Actions</p>
                <Button 
                  onClick={() => setShowResetConfirm(true)}
                  variant="outline" 
                  disabled={isResetting}
                  className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all group"
                >
                  {isResetting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting App...</>
                  ) : (
                    <><RotateCcw className="w-4 h-4 mr-2 group-hover:rotate-[-45deg] transition-transform" /> Master App Reset</>
                  )}
                </Button>
                <p className="mt-2 text-[9px] text-center text-red-500/40 italic">
                  This will delete all tournaments, teams, matches, and non-admin users.
                </p>
              </div>
            )}

            <p className="text-[10px] text-center text-red-400 font-bold uppercase tracking-wider mt-4">
              System Version 1.0.8 (Active)
            </p>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        title="DANGER: Master Reset"
        description="This action will permanently delete all tournaments, teams, matches, and player profiles (except yours). Please enter the admin security key to confirm."
        confirmText="Reset Everything"
        variant="destructive"
        requiredPassword="RESET-VB-2024"
        onConfirm={handleMasterReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
