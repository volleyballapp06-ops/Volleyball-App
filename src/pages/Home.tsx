import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, MapPin, Users, ArrowRight, Star, Calendar, Zap, History, Plus, Phone, XCircle, UserCheck } from 'lucide-react';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, increment, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { Court, TeamChallenge } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { calculateDistance, cn } from '../lib/utils';
import { ImageUpload } from '../components/ImageUpload';
import { format } from 'date-fns';
import { generateGeohash } from '../lib/geo';
import NearbyPlayersList from '../components/NearbyPlayersList';

export default function Home() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courts, setCourts] = useState<Court[]>([]);
  const [activeMatches, setActiveMatches] = useState<TeamChallenge[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [newCourt, setNewCourt] = useState({
    name: '',
    location: '',
    district: 'Chennai',
    type: 'Outdoor' as 'Outdoor' | 'Turf' | 'Indoor',
    access: 'Free' as 'Free' | 'Paid',
    images: [] as string[],
    contact: ''
  });

  const tournaments = [
    { date: '24', month: 'OCT', name: 'Kanchipuram District Open', info: 'Kanchipuram Stadium • 32 Teams • Entry: ₹500', status: 'Registering' },
    { date: '02', month: 'NOV', name: 'State Level Invitation Cup', info: 'Nehru Stadium, Chennai • Pro Tier', status: 'Invite Only' },
    { date: '15', month: 'NOV', name: 'Madurai Spikers League', info: 'Race Course Grounds • U-21 Division', status: 'Registering' },
    { date: '21', month: 'NOV', name: 'Coimbatore Corporate Clash', info: 'Codissia Complex • Mixed Doubles', status: 'Open' },
  ];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'courts'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courts');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'teamChallenges'), 
      where('status', '==', 'accepted'),
      orderBy('scheduledDate', 'asc'),
      limit(3)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChallenge)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teamChallenges');
    });
    return () => unsubscribe();
  }, []);

  const handleAddCourt = async () => {
    if (!user) {
      toast.error('Please sign in to add a court');
      return;
    }
    if (!newCourt.name || !newCourt.location) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      let lat = null;
      let lng = null;

      if (navigator.geolocation) {
        toast.info("Capturing your current location for the court...");
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }

      const geohash = lat && lng ? generateGeohash({ lat, lng }) : null;

      await addDoc(collection(db, 'courts'), {
        ...newCourt,
        lat,
        lng,
        geohash,
        facilities: ['Standard Court'],
        rating: 4.0,
        imageUrl: newCourt.images[0] || `https://picsum.photos/seed/${Date.now()}/800/600`,
        images: newCourt.images,
        contact: newCourt.contact,
        ratingStats: {
          sum: 0,
          count: 0
        },
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });
      toast.success('Court added successfully!');
      setIsAddingCourt(false);
      setNewCourt({ name: '', location: '', district: 'Chennai', type: 'Outdoor', access: 'Free', images: [], contact: '' });
    } catch (error) {
      console.error('Error adding court:', error);
      toast.error('Failed to add court');
    }
  };

  const completionFields = [
    { value: profile?.location },
    { value: profile?.skillLevel },
    { value: profile?.playingStyle },
    { value: profile?.bio },
    { value: profile?.photoURL }
  ];
  const completedCount = completionFields.filter(f => !!f.value).length;
  const completionPercentage = Math.round((completedCount / completionFields.length) * 100);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 🚀 Header & Quick Actions */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground uppercase italic leading-none flex flex-wrap gap-x-4">
            Hello, <span className="text-primary italic inline-block transform -skew-x-6">{profile?.displayName?.split(' ')[0] || 'Player'}</span>
          </h1>
          <p className="text-muted-foreground text-sm font-medium tracking-tight">Your volleyball hub for {profile?.location || 'Tamil Nadu'}.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/teams">
            <Button variant="outline" className="h-11 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest border-border hover:bg-muted">
              Find Teams
            </Button>
          </Link>
          <Link to="/teams">
            <Button className="h-11 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              Challenge Team
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* 🏟 Main Content Area */}
        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          
          {/* PROFILE COMPLETION - Only if needed */}
          {completionPercentage < 100 && (
            <section className="bg-card rounded-3xl p-6 border border-primary/20 shadow-xl shadow-primary/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Star className="w-24 h-24 text-primary rotate-12" />
              </div>
              <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="176"
                      strokeDashoffset={176 - (176 * completionPercentage) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out text-primary"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-primary">
                    {completionPercentage}%
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-black text-lg uppercase italic tracking-tight mb-1">Boost Your Rank</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    Complete your credentials to unlock <span className="text-primary font-bold">Verified Player</span> status and join higher tier leagues.
                  </p>
                  <Link to="/profile">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold px-6 h-9 rounded-lg uppercase tracking-widest text-[10px]">
                      Verify Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ⚡ UPCOMING MATCHES */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-black uppercase italic flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary fill-primary" /> Team Matches
              </h2>
              <Link to="/teams" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 uppercase tracking-widest">
                Browse Teams <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMatches.length > 0 ? activeMatches.map((match) => (
                <Card key={match.id} className="rounded-2xl border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="p-0">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-bold uppercase">
                          Friendly Match
                        </Badge>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          {format(new Date(match.scheduledDate), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <div className="text-center flex-1">
                          <p className="text-sm font-black uppercase truncate">{match.fromTeamName}</p>
                        </div>
                        <div className="text-primary font-black italic text-xs">VS</div>
                        <div className="text-center flex-1">
                          <p className="text-sm font-black uppercase truncate">{match.toTeamName}</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/40">
                        <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" /> {match.location}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-full py-12 bg-muted/30 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No upcoming matches scheduled</p>
                  <Button variant="link" className="text-primary font-bold text-xs" onClick={() => navigate('/teams')}>Challenge a team</Button>
                </div>
              )}
            </div>
          </section>

          {/* 🏆 TOURNAMENTS GRID */}
          <section className="bg-card border rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black uppercase italic flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Championships
              </h2>
              <Link to="/tournaments" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline px-3 py-1 bg-primary/5 rounded-full border border-primary/10">Explore All</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {tournaments.slice(0, 4).map((t, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="flex gap-4 items-start">
                    <div className="shrink-0 w-12 h-14 bg-muted rounded-xl flex flex-col items-center justify-center text-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <span className="text-lg font-black leading-none">{t.date}</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest opacity-70">{t.month}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-sm font-black uppercase italic leading-tight group-hover:text-primary transition-colors">{t.name}</h3>
                      <p className="text-[11px] text-muted-foreground font-medium leading-normal">{t.info.split('•')[0]}</p>
                      <Badge variant="ghost" className="text-[9px] font-black tracking-widest p-0 h-auto text-primary uppercase">
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/tournaments">
              <Button className="w-full mt-10 bg-muted hover:bg-muted/80 text-foreground font-black h-12 rounded-xl transition-all border border-border/50">
                Tournament Registry <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </section>

        </div>

        {/* 📊 Sidebar Column */}
        <aside className="lg:col-span-4 space-y-6 md:space-y-8">
          
          {/* PLAYER RANK & STATS */}
          <section className="bg-[#1a1a1a] text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[64px] rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Global Rank</span>
                <Badge className="bg-primary hover:bg-primary font-black text-[10px]">PRO</Badge>
              </div>

              <div className="flex items-end justify-between border-b border-white/10 pb-6">
                <div>
                  <span className="text-5xl font-black italic">#124</span>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Season 04 • Tamil Nadu</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black italic text-emerald-400">8.4</span>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Rating</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-xl font-black italic block">{profile?.stats?.tournamentMatches || 0}</span>
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Leagues</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-xl font-black italic block">{profile?.stats?.friendlyMatches || 0}</span>
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Friendlies</span>
                </div>
              </div>
            </div>
          </section>

          {/* TRUSTED CONNECTIONS */}
          {profile?.connections && (profile as any).connections.length > 0 && (
            <section className="bg-card border rounded-3xl p-6 shadow-sm overflow-hidden relative group transition-all duration-500 hover:shadow-[0_20px_50px_rgba(16,185,129,0.05)] border-white/5 hover:border-emerald-500/20">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000 -rotate-12 group-hover:rotate-0">
                <UserCheck className="w-24 h-24 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2 mb-1">
                    <UserCheck className="w-4 h-4 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> My <span className="text-emerald-500">Circle</span>
                  </h2>
                  <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Verified Players</p>
                </div>
                <Link to="/players?tab=connections" className="h-8 px-4 flex items-center rounded-full bg-white/[0.03] text-[9px] font-black text-muted-foreground uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
                  Manage Network
                </Link>
              </div>
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex -space-x-4">
                  {(profile as any).connections.slice(0, 5).map((uid: string) => (
                     <Avatar key={uid} className="w-12 h-12 border-[4px] border-card rounded-full grayscale hover:grayscale-0 transition-all cursor-pointer hover:scale-110 hover:z-20 ring-1 ring-white/5">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} />
                        <AvatarFallback className="bg-muted text-[10px] font-black">P</AvatarFallback>
                     </Avatar>
                  ))}
                  {(profile as any).connections.length > 5 && (
                    <div className="w-12 h-12 rounded-full border-[4px] border-card bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground ring-1 ring-white/5">
                      +{(profile as any).connections.length - 5}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black italic text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{(profile as any).connections.length}</p>
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">Connections</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-[10px] text-muted-foreground/60 font-medium leading-relaxed italic">
                  "Building a network of elite athletes to compete at the highest level."
                </p>
              </div>
            </section>
          )}

          {/* NEARBY PLAYERS */}
          <section className="bg-card border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Recruits Near You
              </h2>
              <Link to="/players" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary">View All</Link>
            </div>
            <NearbyPlayersList />
          </section>

          {/* COURT EXPLORER */}
          <section className="bg-card border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Active Courts
              </h2>
              <Dialog open={isAddingCourt} onOpenChange={setIsAddingCourt}>
                <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-[9px] font-black tracking-widest uppercase hover:bg-primary/10 hover:text-primary px-2")}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Add New Court</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="court-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Court Name</Label>
                      <Input 
                        id="court-name" 
                        placeholder="e.g. YMCA Marina Court" 
                        value={newCourt.name}
                        className="h-11 rounded-xl"
                        onChange={(e) => setNewCourt({...newCourt, name: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="court-location" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location Address</Label>
                      <Input 
                        id="court-location" 
                        placeholder="e.g. Marina Beach, Chennai" 
                        value={newCourt.location}
                        className="h-11 rounded-xl"
                        onChange={(e) => setNewCourt({...newCourt, location: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</Label>
                        <Select 
                          value={newCourt.type} 
                          onValueChange={(val: any) => setNewCourt({...newCourt, type: val})}
                        >
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Outdoor">Outdoor</SelectItem>
                            <SelectItem value="Turf">Turf</SelectItem>
                            <SelectItem value="Indoor">Indoor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Access</Label>
                        <Select 
                          value={newCourt.access} 
                          onValueChange={(val: any) => setNewCourt({...newCourt, access: val})}
                        >
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Access" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Free">Free</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Court Images</Label>
                      <ImageUpload 
                        onImagesChange={(urls) => setNewCourt({...newCourt, images: urls})}
                        initialImages={newCourt.images}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddCourt} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase tracking-widest text-xs">
                      Post Court
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="space-y-5">
            {courts.length > 0 ? courts.map((court) => (
              <div key={court.id} className="flex gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-bold text-foreground">{court.name}</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-[11px] font-bold">
                        {court.ratingStats && court.ratingStats.count > 0 
                          ? (court.ratingStats.sum / court.ratingStats.count).toFixed(1)
                          : (court.rating || '4.5')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold uppercase">{court.type || 'Outdoor'}</span>
                       <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${court.access === 'Paid' ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                         {court.access || 'Free'}
                       </span>
                    </div>
                    {userLocation && court.lat && court.lng && (
                      <span className="text-[11px] text-emerald-500 font-bold">
                        {calculateDistance(userLocation.lat, userLocation.lng, court.lat, court.lng).toFixed(1)} km
                      </span>
                    )}
                  </div>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(court.name + ' ' + court.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" />
                    {court.location}
                  </a>
                  {court.contact && (
                    <a 
                      href={`tel:${court.contact.replace(/\s+/g, '')}`}
                      className="text-[12px] text-emerald-600 hover:underline font-medium flex items-center gap-1 mt-1"
                    >
                      <Phone className="w-3 h-3" />
                      Call: {court.contact}
                    </a>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">No courts found near you.</p>
            )}
          </div>
          <Link to="/courts">
            <Button variant="outline" className="w-full mt-6 border-border hover:bg-muted text-foreground font-bold h-12 rounded-lg">
              Find All Courts
            </Button>
          </Link>
        </section>

        <section className="clean-card">
          <h2 className="section-title">Players Near You</h2>
          <NearbyPlayersList />
        </section>
      </aside>
    </div>
  </div>
);
}
