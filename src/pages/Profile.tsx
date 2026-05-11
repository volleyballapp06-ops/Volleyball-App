import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Trophy, Users, MapPin, Calendar, Star, Shield, LogOut, Edit2, Zap, Target, Camera, Upload, Loader2, ArrowRight, Activity, History, Check } from 'lucide-react';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { db, signOut, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, getDoc, writeBatch, setDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import SeedData from '../components/SeedData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Team, UserProfile } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import { getCurrentPosition, generateGeohash } from '../lib/geo';
import { cn } from '../lib/utils';

export default function Profile() {
  const { user, profile: currentUserProfile, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUid = searchParams.get('uid');
  
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  const isOwnProfile = !targetUid || targetUid === user?.uid;
  const profile = isOwnProfile ? currentUserProfile : targetProfile;
  const loading = authLoading || profileLoading;

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    location: '',
    geohash: '',
    lat: 0 as number | undefined,
    lng: 0 as number | undefined,
    bio: '',
    photoURL: '',
    tournamentReady: false
  });

  const validateUsername = (username: string) => {
    const re = /^[a-z0-9._]+$/;
    return re.test(username);
  };

  const handleEditOpen = () => {
    if (profile) {
      setEditForm({
        username: profile.username || '',
        displayName: profile.displayName || '',
        location: profile.location || '',
        geohash: profile.geohash || '',
        lat: profile.lat,
        lng: profile.lng,
        bio: profile.bio || '',
        photoURL: profile.photoURL || '',
        tournamentReady: profile.tournamentReady || false
      });
      setIsEditing(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions for profile photo
          const MAX_SIZE = 400;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          setEditForm(prev => ({ ...prev, photoURL: base64 }));
          setIsUploading(false);
          toast.success('Photo uploaded locally. Save changes to update profile.');
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error('Failed to process image');
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    
    const newUsername = editForm.username.toLowerCase().trim();
    const oldUsername = profile.username;

    if (newUsername && !validateUsername(newUsername)) {
      toast.error('Username can only contain lowercase letters, numbers, underscores (_), and periods (.)');
      return;
    }

    setIsCheckingUsername(true);
    try {
      const batch = writeBatch(db);
      
      // If username changed
      if (newUsername !== oldUsername) {
        if (newUsername) {
          // Check if new username is taken
          const usernameRef = doc(db, 'usernames', newUsername);
          const usernameDoc = await getDoc(usernameRef);
          
          if (usernameDoc.exists()) {
            toast.error('Username already taken');
            setIsCheckingUsername(false);
            return;
          }
          
          // Claim new username
          batch.set(doc(db, 'usernames', newUsername), { uid: user.uid });
        }
        
        // Release old username
        if (oldUsername) {
          batch.delete(doc(db, 'usernames', oldUsername));
        }
      }

      // Update user profile
      const userRef = doc(db, 'users', user.uid);
      const updateData: any = {
        ...editForm,
        username: newUsername
      };

      // Filter out undefined values to prevent Firestore errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      batch.update(userRef, updateData);

      await batch.commit();
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Update failed', error);
      toast.error('Failed to update profile');
    } finally {
      setIsCheckingUsername(false);
    }
  };

  useEffect(() => {
    const fetchTargetProfile = async () => {
      if (targetUid && targetUid !== user?.uid) {
        setProfileLoading(true);
        try {
          const docRef = doc(db, 'users', targetUid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setTargetProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
          } else {
            toast.error('User profile not found');
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          toast.error('Failed to load profile');
        } finally {
          setProfileLoading(false);
        }
      } else {
        setTargetProfile(null);
      }
    };

    fetchTargetProfile();
  }, [targetUid, user?.uid]);

  const handleConnect = async () => {
    if (!user || !targetUid) {
      toast.error('Please sign in to connect');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        connections: arrayUnion(targetUid)
      });
      toast.success('Connected with player');
    } catch (error) {
      toast.error('Failed to connect');
    }
  };

  const handleDisconnect = async () => {
    if (!user || !targetUid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        connections: arrayRemove(targetUid)
      });
      toast.success('Removed link');
    } catch (error) {
      toast.error('Failed to remove link');
    }
  };

  const isConnected = targetUid ? currentUserProfile?.connections?.includes(targetUid) : false;

  useEffect(() => {
    const activeUid = isOwnProfile ? user?.uid : targetUid;
    if (activeUid) {
      const q = query(collection(db, 'teams'), where('members', 'array-contains', activeUid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUserTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      });
      return () => unsubscribe();
    }
  }, [user, targetUid, isOwnProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isOwnProfile && !profile) {
    return (
      <div className="text-center py-20 bg-card rounded-lg border border-border">
        <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-4">Profile not found</h2>
        <p className="text-muted-foreground mb-8">The user profile you are looking for does not exist or has been removed.</p>
        <Link to="/players">
          <Button>Back to Players</Button>
        </Link>
      </div>
    );
  }

  if (isOwnProfile && !user) {
    return (
      <div className="text-center py-20 bg-card rounded-lg border border-border">
        <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-4">Please sign in to view your profile</h2>
        <p className="text-muted-foreground mb-8">You need to be authenticated to access your match history and stats.</p>
      </div>
    );
  }

  // Calculate profile completion
  const completionFields = [
    { key: 'username', label: 'Username', value: profile?.username },
    { key: 'location', label: 'Location', value: profile?.location },
    { key: 'bio', label: 'Short Bio', value: profile?.bio },
    { key: 'photoURL', label: 'Profile Photo', value: profile?.photoURL }
  ];

  const completedCount = completionFields.filter(f => !!f.value).length;
  const completionPercentage = Math.round((completedCount / completionFields.length) * 100);
  const missingFields = completionFields.filter(f => !f.value);

  const perks = [
    { icon: <Shield className="w-3 h-3" />, text: "Verified Badge" },
    { icon: <Target className="w-3 h-3" />, text: "Better Matchmaking" },
    { icon: <Star className="w-3 h-3" />, text: "Priority Discovery" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 🚀 Profile Hero Section */}
      <section className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background rounded-[2.5rem] border border-border/50" />
        
        {/* Technical Grid Accent */}
        <div className="absolute inset-0 opacity-5 pointer-events-none rounded-[2.5rem]" 
             style={{ backgroundImage: 'radial-gradient(var(--color-primary) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

        <div className="relative p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-8">
          {/* Avatar Area */}
          <div className="relative">
            <Avatar className="w-32 h-32 md:w-48 md:h-48 border-[6px] border-card shadow-2xl rounded-3xl">
              <AvatarImage src={profile?.photoURL || ''} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black italic">
                {profile?.displayName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {completionPercentage === 100 && (
              <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-lg ring-4 ring-card">
                <Shield className="w-5 h-5 fill-white" />
              </div>
            )}
          </div>

          {/* User Ident Section */}
          <div className="flex-1 text-center md:text-left pb-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-foreground leading-none">
                  {profile?.displayName}
                </h1>
                {profile?.role === 'admin' && (
                  <Badge className="bg-primary text-white font-black text-[10px] px-2 py-0.5 rounded-lg">SYSTEM ADMIN</Badge>
                )}
                {profile?.tournamentReady && (
                  <Badge className="bg-emerald-500 text-white font-black text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                    <Trophy className="w-2.5 h-2.5" /> TOURNAMENT READY
                  </Badge>
                )}
              </div>
            {profile?.username && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                <span className="text-primary font-mono text-sm font-black italic">@{profile.username}</span>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {profile.location || 'Tamil Nadu'}
                </span>
                <span className="text-muted-foreground/30">•</span>
                <button 
                  onClick={() => window.location.href='/players?tab=connections'}
                  className="text-[10px] font-black text-white hover:text-emerald-500 transition-colors flex items-center gap-1.5 uppercase tracking-widest group"
                >
                  <Users className="w-3.5 h-3.5 group-hover:text-emerald-500 transition-colors" />
                  <span className="opacity-60">Connections:</span>
                  <span className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{(profile as any).connections?.length || 0}</span>
                </button>
              </div>
            )}
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              {isOwnProfile ? (
                <>
                  <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogTrigger onClick={handleEditOpen} className={cn(buttonVariants({ variant: "default" }), "bg-primary hover:bg-primary/90 text-white font-black h-10 px-6 rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20")}>
                      <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Records
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic">Update Personal Records</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="flex flex-col items-center gap-4 mb-4">
                          <Avatar className="w-24 h-24 border-2 border-primary/20 rounded-2xl">
                            <AvatarImage src={editForm.photoURL} referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-muted text-primary text-xl font-bold">
                              {editForm.displayName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileUpload}
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="font-black text-[9px] uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5 rounded-xl h-8 px-4"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            ) : (
                              <Camera className="w-3.5 h-3.5 mr-2" />
                            )}
                            {isUploading ? 'SYNCING...' : 'RELAY PHOTO'}
                          </Button>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Callsign (Display Name)</Label>
                          <Input 
                            id="name" 
                            value={editForm.displayName} 
                            className="h-11 rounded-xl"
                            onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unique Tag (@username)</Label>
                          <Input 
                            id="username" 
                            placeholder="e.g. janesmith_01"
                            value={editForm.username} 
                            className="h-11 rounded-xl"
                            onChange={(e) => setEditForm({...editForm, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="location" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base of Operations (District)</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="location" 
                              value={editForm.location} 
                              className="h-11 rounded-xl"
                              onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                            />
                            <Button 
                              type="button" 
                              variant="outline" 
                              className="shrink-0 text-primary border-primary/20 hover:bg-primary/5 h-11 w-11 rounded-xl"
                              onClick={async () => {
                                try {
                                  const pos = await getCurrentPosition();
                                  setEditForm(prev => ({
                                    ...prev,
                                    lat: pos.lat,
                                    lng: pos.lng,
                                    geohash: generateGeohash(pos)
                                  }));
                                  toast.success('GPS coordinates synced');
                                } catch (err) {
                                  toast.error('GPS failure');
                                }
                              }}
                            >
                              <MapPin className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="bio" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Biography / Playstyle</Label>
                          <textarea 
                            id="bio"
                            className="flex min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Tell the network about your skills..."
                            value={editForm.bio}
                            onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/50">
                          <div className="space-y-1">
                            <Label htmlFor="tournament-switch-edit" className="text-xs font-black uppercase tracking-wider cursor-pointer">Tournament Ready</Label>
                            <p className="text-[10px] text-muted-foreground font-medium">Allow teams to scout you for tournaments</p>
                          </div>
                          <Switch
                            id="tournament-switch-edit"
                            checked={editForm.tournamentReady}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, tournamentReady: checked })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={handleSaveProfile} 
                          disabled={isCheckingUsername}
                          className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase tracking-widest text-xs"
                        >
                          {isCheckingUsername ? 'SYNCING DATA...' : 'UPLOAD TO CORE'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="outline" 
                    className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest border-destructive/20 text-destructive hover:bg-destructive/10" 
                    onClick={() => signOut(auth)}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <>
                  {isConnected ? (
                    <Button 
                      className="bg-emerald-500 hover:bg-red-500 text-white font-black h-10 px-8 rounded-xl uppercase tracking-widest text-[10px] group/profile-btn transition-all"
                      onClick={handleDisconnect}
                    >
                      <span className="group-hover/profile-btn:hidden flex items-center gap-2">
                        <Check className="w-4 h-4" /> Connected
                      </span>
                      <span className="hidden group-hover/profile-btn:inline">Remove</span>
                    </Button>
                  ) : (
                    <Button 
                      className="bg-primary hover:bg-primary/90 text-white font-black h-10 px-8 rounded-xl uppercase tracking-widest text-[10px]"
                      onClick={handleConnect}
                    >
                      Connect
                    </Button>
                  )}
                  <Button variant="outline" className="h-10 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-border">
                    Message
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="hidden lg:flex flex-col gap-2 min-w-[200px]">
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] block leading-none">Global Rank</span>
                <span className="text-2xl font-black italic text-primary leading-none">#124</span>
              </div>
              <Activity className="w-6 h-6 text-primary opacity-30" />
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black text-emerald-500/50 uppercase tracking-[0.2em] block leading-none">Win Ratio</span>
                <span className="text-2xl font-black italic text-emerald-500 leading-none">68%</span>
              </div>
              <Target className="w-6 h-6 text-emerald-500 opacity-50" />
            </div>

            {isOwnProfile && (
              <div 
                className={cn(
                  "border rounded-2xl p-4 flex items-center justify-between transition-all select-none",
                  profile?.tournamentReady 
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-600" 
                    : "bg-muted/50 border-border/50 text-muted-foreground opacity-70 hover:opacity-100"
                )}
              >
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] block leading-none">Tournament Status</span>
                  <span className="text-sm font-black italic uppercase leading-none">
                    {profile?.tournamentReady ? 'OPEN FOR SQUAD' : 'UNAVAILABLE'}
                  </span>
                </div>
                <Switch 
                  checked={profile?.tournamentReady}
                  onCheckedChange={async (checked) => {
                    if (!user) return;
                    try {
                      await updateDoc(doc(db, 'users', user.uid), {
                        tournamentReady: checked
                      });
                      toast.success(checked ? 'Tournament recruitment activated!' : 'Tournament recruitment deactivated');
                    } catch (e) {
                      toast.error('Failed to update status');
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 📊 Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar: Detailed Stats & Bio */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Bio Section */}
          <section className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 italic">Operative Dossier</h3>
            {profile?.bio ? (
              <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/30 pl-4 py-1">
                "{profile.bio}"
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic pl-4">No dossier information available on record.</p>
            )}
          </section>

          {/* Combat Stats Grid */}
          <section className="bg-[#1a1a1a] text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[64px] rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-6 relative z-10 italic">Combat Analytics</h3>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                <Trophy className="w-5 h-5 text-yellow-500 mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black italic block leading-none mb-1">{profile?.stats?.wins || 0}</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Total Victories</span>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                <Target className="w-5 h-5 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black italic block leading-none mb-1">{profile?.stats?.tournamentMatches || 0}</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">League Ops</span>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                <Users className="w-5 h-5 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black italic block leading-none mb-1">{profile?.stats?.friendlyMatches || 0}</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Friendly Skirmish</span>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                <Star className="w-5 h-5 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black italic block leading-none mb-1">8.4</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Core Rating</span>
              </div>
            </div>
          </section>

          {/* Current Team Deployment */}
          {userTeams.length > 0 && (
            <section className="bg-card border border-border/50 rounded-[2rem] p-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 italic">Current Alliance</h3>
              <div className="flex items-center justify-between group cursor-pointer" onClick={() => window.location.href='/teams'}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Shield className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase italic text-sm group-hover:text-primary transition-colors">{userTeams[0].name}</h4>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                      {userTeams[0].members.length} Members | {userTeams[0].district || 'District Alpha'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </section>
          )}

        </div>

        {/* Right Content: Tabs & History */}
        <div className="lg:col-span-8 space-y-8">
          <Tabs defaultValue="matches" className="w-full">
            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-6 border-b border-border mb-8 overflow-x-auto overflow-y-hidden custom-scrollbar pb-1">
              <TabsTrigger 
                value="matches" 
                className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-4 font-black uppercase text-[11px] tracking-[0.2em] italic"
              >
                Mission History
              </TabsTrigger>
              <TabsTrigger 
                value="teams" 
                className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-4 font-black uppercase text-[11px] tracking-[0.2em] italic"
              >
                Alliances
              </TabsTrigger>
              {profile?.role === 'admin' && (
                <TabsTrigger 
                  value="admin" 
                  className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-4 font-black uppercase text-[11px] tracking-[0.2em] italic"
                >
                  Core Override
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="matches" className="mt-0 focus-visible:outline-none">
              <div className="space-y-6">
                <section className="bg-card border border-border/50 rounded-[2.5rem] p-12 text-center">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 opacity-40">
                    <History className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic mb-2">No Combat Data Detected</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8 font-medium">
                    Initiate your first mission by joining a tournament or challenging a local team.
                  </p>
                  <Link to="/teams">
                    <Button className="bg-primary hover:bg-primary/90 text-white font-black h-12 px-8 rounded-xl uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                      Deploy Now
                    </Button>
                  </Link>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="teams" className="mt-0 focus-visible:outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userTeams.length > 0 ? userTeams.map(team => (
                  <Card key={team.id} className="rounded-3xl border-border/50 overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary border border-primary/10 group-hover:bg-primary/10 transition-colors">
                          <Shield className="w-8 h-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-black uppercase italic group-hover:text-primary transition-colors">{team.name}</h4>
                            <Badge variant="ghost" className="text-[9px] font-black tracking-tighter uppercase text-primary">
                              {team.isPrivate ? 'PRIVATE' : 'HQ OPEN'}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {team.members.length} Combatants • {team.stats?.wins || 0} Victories
                          </p>
                        </div>
                      </div>
                      <Link to="/teams">
                        <Button className="w-full mt-6 bg-muted hover:bg-primary hover:text-white text-foreground font-black h-10 rounded-xl transition-all border-none">
                          Infiltrate HQ
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="col-span-full py-20 bg-muted/20 border border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                    <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h4 className="text-lg font-black uppercase italic mb-2 text-muted-foreground">No Alliances On Record</h4>
                    <Link to="/teams">
                      <Button variant="link" className="text-primary font-black uppercase text-[10px] tracking-widest">Establish New Team</Button>
                    </Link>
                  </div>
                )}
              </div>
            </TabsContent>

            {profile?.role === 'admin' && (
              <TabsContent value="admin" className="mt-0 focus-visible:outline-none">
                <section className="bg-card border border-border/50 rounded-[2.5rem] p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <Zap className="w-5 h-5 text-primary fill-primary" />
                    <h3 className="text-lg font-black uppercase italic">System Overrides</h3>
                  </div>
                  <SeedData />
                </section>
              </TabsContent>
            )}
          </Tabs>
        </div>

      </div>
    </div>
  );
}
