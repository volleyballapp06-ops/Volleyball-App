import React, { useEffect, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { User, Search, Filter, UserPlus, UserCheck, Shield, Zap, Bell, Check, X, Clock, Users, Target, MapPin, LogOut, Trophy } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { getCurrentPosition, calculateDistance, formatDistance } from '../lib/geo';

interface PlayerProfile {
  uid: string;
  username?: string;
  displayName: string;
  photoURL: string;
  role: string;
  location: string;
  lat?: number;
  lng?: number;
  geohash?: string;
  bio?: string;
  tournamentReady?: boolean;
  isBanned?: boolean;
  lastActive?: any;
  stats: {
    tournamentMatches: number;
    friendlyMatches: number;
    wins: number;
  };
}

export default function Players() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'connections'>('discover');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [connectionsList, setConnectionsList] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNearby, setShowNearby] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showTournamentReadyOnly, setShowTournamentReadyOnly] = useState(false);

  const toggleNearby = async () => {
    if (showNearby) {
      setShowNearby(false);
      return;
    }

    setIsLocating(true);
    try {
      const pos = await getCurrentPosition();
      setUserLocation(pos);
      setShowNearby(true);
      toast.success('Showing players near you');
    } catch (err) {
      toast.error('Could not get your location');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    // Force black background for this page
    document.body.style.backgroundColor = '#000000';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), limit(100));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as PlayerProfile));
      setPlayers(data);
      
      if (user && profile) {
        const connectionIds = (profile as any).connections || [];
        setConnectionsList(data.filter(p => connectionIds.includes(p.uid)));
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribe();
    };
  }, [user, profile]);

  const handleConnect = async (targetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to connect with players');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        connections: arrayUnion(targetId)
      });
      toast.success('Added to connections');
    } catch (error) {
      toast.error('Failed to connect');
    }
  };

  const handleDisconnect = async (targetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        connections: arrayRemove(targetId)
      });
      toast.success('Removed from connections');
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const isConnected = (uid: string) => (profile as any)?.connections?.includes(uid);

  const handleToggleBan = async (player: PlayerProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile || profile.role !== 'admin' && profile.email !== 'volleyballapp06@gmail.com') {
      toast.error('Only admins can ban players');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', player.uid), {
        isBanned: !player.isBanned
      });
      toast.success(player.isBanned ? 'Player unbanned' : 'Player banned successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error('Failed to update ban status');
    }
  };

  const filteredPlayers = players.filter(p => {
    const cleanSearch = searchTerm.toLowerCase().trim();
    
    // Filter out users without lat/lng if nearby is active
    if (showNearby && (!p.lat || !p.lng || !userLocation)) return false;

    // Tournament ready filter
    if (showTournamentReadyOnly && !p.tournamentReady) return false;

    if (!cleanSearch) return true;
    
    const matchesDisplayName = p.displayName.toLowerCase().includes(cleanSearch);
    const matchesUsername = p.username?.toLowerCase().includes(cleanSearch);
    const matchesLocation = p.location?.toLowerCase().includes(cleanSearch);
    
    return matchesDisplayName || matchesUsername || matchesLocation;
  }).sort((a, b) => {
    if (showNearby && userLocation && a.lat && a.lng && b.lat && b.lng) {
      const distA = calculateDistance(userLocation, { lat: a.lat, lng: a.lng });
      const distB = calculateDistance(userLocation, { lat: b.lat, lng: b.lng });
      return distA - distB;
    }

    const cleanSearch = searchTerm.toLowerCase().trim();
    if (!cleanSearch) return 0;

    const aStarts = a.displayName.toLowerCase().startsWith(cleanSearch) || 
                   a.username?.toLowerCase().startsWith(cleanSearch);
    const bStarts = b.displayName.toLowerCase().startsWith(cleanSearch) || 
                   b.username?.toLowerCase().startsWith(cleanSearch);

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return 0;
  });

  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

  const displayedList = (() => {
    const list = activeTab === 'discover' ? filteredPlayers : connectionsList;
    
    let result = list;
    if (searchTerm && activeTab !== 'discover') {
      const cleanSearch = searchTerm.toLowerCase().trim();
      result = list.filter(p => 
        p.displayName.toLowerCase().includes(cleanSearch) || 
        p.username?.toLowerCase().includes(cleanSearch) || 
        p.location?.toLowerCase().includes(cleanSearch)
      );
    }

    if (activeTab === 'connections') {
      return [...result].sort((a, b) => {
        if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
        return 0; // Recent would need createdAt in connections mapping
      });
    }

    return result;
  })();

  return (
    <div className="flex flex-col min-h-screen bg-black -mx-4 -mt-4 sm:-mt-8 px-4 pb-24 sm:-mx-8 sm:px-8 font-sans transition-all duration-700">
      {/* Top Search Bar */}
      <div className="sticky top-[-1px] z-50 bg-black/95 backdrop-blur-xl pt-4 pb-3 -mx-4 px-4 border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link to="/" className="lg:hidden text-white/40 hover:text-white transition-colors">
            <Trophy className="w-6 h-6" />
          </Link>
          
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white/60 transition-colors" />
            <Input 
              placeholder={activeTab === 'discover' ? "Search for players..." : `Search in ${activeTab}...`} 
              className="w-full pl-12 pr-10 h-11 bg-white/[0.03] border-none rounded-2xl text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-white/20 transition-all shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl transition-all",
                showNearby ? "bg-white text-black shadow-lg shadow-white/10 scale-105" : "text-white/20 hover:text-white hover:bg-white/5"
              )}
              onClick={toggleNearby}
              disabled={isLocating}
            >
              <MapPin className={cn("w-4 h-4", isLocating && "animate-pulse")} />
            </Button>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-11 w-11 rounded-2xl transition-all border border-transparent",
              showTournamentReadyOnly 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-lg shadow-emerald-500/10" 
                : "text-white/20 hover:bg-white/5"
            )}
            onClick={() => setShowTournamentReadyOnly(!showTournamentReadyOnly)}
          >
            <Trophy className={cn("w-5 h-5 transition-transform", showTournamentReadyOnly && "fill-current scale-110")} />
          </Button>
        </div>
      </div>

      {/* Hero Section for Connections */}
      {activeTab === 'connections' && !loading && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto w-full px-4 pt-10 pb-6 text-center relative pointer-events-none"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic mb-2 relative">
            My <span className="text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Circle</span>
          </h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            {connectionsList.length} TRUSTED ATHLETES
          </p>
          <div className="flex justify-center gap-2 pointer-events-auto">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSortBy('name')}
                className={cn(
                  "h-8 px-4 rounded-full text-[9px] font-black uppercase tracking-widest transition-all", 
                  sortBy === 'name' ? "text-white bg-white/10 ring-1 ring-white/20" : "text-white/20 hover:text-white/40"
                )}
              >
                Sort: Name
              </Button>
          </div>
        </motion.div>
      )}

      {/* Tab Switcher */}
      <div className="max-w-2xl mx-auto w-full px-4 mb-8 mt-4">
        <div className="flex bg-white/[0.02] p-1.5 rounded-[24px] border border-white/5 backdrop-blur-sm">
          {[
            { id: 'discover', label: 'Discover', icon: Search },
            { id: 'connections', label: 'Connections', icon: UserCheck }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[18px] text-[10px] font-black uppercase tracking-[0.15em] transition-all relative overflow-hidden group",
                activeTab === tab.id 
                  ? "bg-white text-black shadow-[0_10px_20px_rgba(255,255,255,0.1)] scale-[1.02] z-10" 
                  : "text-white/30 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <tab.icon className={cn("w-4 h-4 transition-transform duration-500", activeTab === tab.id ? "scale-110" : "group-hover:scale-110")} />
              {tab.label}
              {tab.id === 'connections' && connectionsList.length > 0 && (
                <span className={cn(
                  "ml-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black",
                  activeTab === tab.id ? "bg-black/10 text-black/60" : "bg-white/10 text-white/30"
                )}>
                  {connectionsList.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results List / Grid */}
      <div className={cn(
        "max-w-2xl mx-auto w-full transition-all duration-500 ease-in-out",
        activeTab === 'connections' && displayedList.length > 0 ? "grid grid-cols-2 gap-4 pb-12" : "space-y-1"
      )}>
        {loading ? (
          <div className="col-span-full space-y-4 pt-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-4 px-2 py-3 animate-pulse">
                <div className="w-14 h-14 bg-white/5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedList.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {displayedList.map((player, index) => (
              <motion.div
                key={player.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ 
                  delay: index * 0.03,
                  type: "spring",
                  stiffness: 100,
                  damping: 15
                }}
                className={cn(
                  "group relative",
                  activeTab === 'discover' && "w-full"
                )}
              >
                <Dialog>
                  {activeTab === 'discover' ? (
                    <div className="flex items-center gap-4 px-4 py-5 hover:bg-white/[0.04] active:bg-white/[0.06] transition-all rounded-[22px] group/row border border-transparent hover:border-white/5 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/[0.02] to-emerald-500/0 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                      <DialogTrigger className="flex flex-1 items-center gap-4 text-left outline-none cursor-pointer relative z-10">
                        <div className="relative shrink-0">
                          <div className={cn(
                            "absolute inset-0 bg-emerald-500/20 rounded-full blur-md opacity-0 group-hover/row:opacity-100 transition-opacity",
                            isConnected(player.uid) && "opacity-40"
                          )} />
                          <Avatar className="w-14 h-14 border border-white/10 shadow-lg group-hover/row:scale-105 transition-transform duration-500 ring-0 group-hover/row:ring-2 ring-emerald-500/20">
                            <AvatarImage src={player.photoURL} referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-[#1a1a1a] text-white/20 text-xl font-bold">
                              {player.displayName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {player.role === 'admin' && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 p-1 rounded-full ring-2 ring-black shadow-lg shadow-blue-500/40">
                              <Check className="w-3 h-3 text-white stroke-[4]" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-black text-white truncate text-[15px] tracking-tight group-hover/row:text-emerald-400 transition-colors">
                              {player.username || player.displayName.replace(/\s+/g, '').toLowerCase()}
                            </p>
                            {player.role === 'admin' && <Check className="w-3.5 h-3.5 text-blue-500 fill-blue-500 stroke-[3]" />}
                            {player.isBanned && (
                              <Badge variant="destructive" className="text-[8px] h-3.5 px-1 font-black uppercase tracking-widest bg-red-500/20 text-red-500 border-red-500/20">BANNED</Badge>
                            )}
                            {player.tournamentReady && (
                              <div className="bg-emerald-500 p-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                                <Zap className="w-2.5 h-2.5 text-white fill-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-white/30 truncate font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="truncate">{player.displayName}</span>
                            {player.location && <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />}
                            <span className="truncate flex items-center gap-1">
                              {player.location}
                              {showNearby && userLocation && player.lat && player.lng && (
                                <span className="text-emerald-500 font-black ml-1">
                                  {formatDistance(calculateDistance(userLocation, { lat: player.lat, lng: player.lng }))}
                                </span>
                              )}
                            </span>
                          </p>
                        </div>
                      </DialogTrigger>

                      <div className="shrink-0 ml-auto pr-1 relative z-10 flex items-center gap-2">
                        {(profile?.role === 'admin' || profile?.email === 'volleyballapp06@gmail.com') && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className={cn(
                              "h-9 w-9 rounded-2xl transition-all border border-white/5",
                              player.isBanned ? "bg-red-500 text-white" : "text-white/20 hover:text-red-500 hover:bg-red-500/10"
                            )}
                            onClick={(e) => handleToggleBan(player, e)}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}
                        {isConnected(player.uid) ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-9 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all group/btn active:scale-95 shadow-lg shadow-emerald-500/5 hover:shadow-red-500/20"
                            onClick={(e) => handleDisconnect(player.uid, e)}
                          >
                            <span className="group-hover/btn:hidden flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5" /> Connected
                            </span>
                            <span className="hidden group-hover/btn:inline">Disconnect</span>
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-9 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5 active:scale-95"
                            onClick={(e) => handleConnect(player.uid, e)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Grid Card for Connections - LUXURY STYLE */
                    <div className="relative group/card flex flex-col items-center p-6 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-emerald-500/30 rounded-[32px] transition-all duration-500 shadow-xl overflow-hidden active:scale-95">
                      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover/card:opacity-100 transition-all duration-700">
                        <UserCheck className="w-12 h-12 text-emerald-500/10 -rotate-12" />
                      </div>
                      <DialogTrigger className="w-full flex flex-col items-center outline-none">
                        <div className="relative mb-5">
                          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl group-hover/card:bg-emerald-500/40 transition-all duration-700" />
                          <Avatar className="w-24 h-24 border-[3px] border-white/10 shadow-2xl relative z-10 group-hover/card:scale-110 transition-transform duration-700 ring-4 ring-emerald-500/10">
                            <AvatarImage src={player.photoURL} referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-[#111] text-white/20 text-3xl font-black">
                              {player.displayName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 w-6 h-6 rounded-full border-[3px] border-black shadow-lg flex items-center justify-center z-20">
                            <Check className="w-3 h-3 text-white stroke-[4]" />
                          </div>
                        </div>
                        
                        <div className="text-center w-full min-w-0 mb-6 px-1 relative z-10">
                          <h3 className="font-black text-white truncate text-[16px] tracking-tight mb-1 group-hover/card:text-emerald-400 transition-colors uppercase italic">{player.displayName}</h3>
                          <div className="flex items-center justify-center gap-2">
                             <p className="text-[9px] text-white/30 truncate font-black uppercase tracking-[0.2em]">
                              {player.location || 'GLOBAL ATHLETE'}
                            </p>
                            {player.tournamentReady && (
                              <Zap className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </DialogTrigger>

                      <div className="flex w-full gap-2 mt-auto relative z-10">
                        <Link 
                          to={`/profile?uid=${player.uid}`}
                          className={cn(
                            "flex-1 h-9 flex items-center justify-center rounded-2xl bg-white/[0.03] hover:bg-emerald-500 hover:text-white border border-white/5 text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 shadow-inner group/prof-btn"
                          )}
                        >
                          <span>View Profile</span>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-2xl bg-white/[0.02] hover:bg-red-500/20 hover:text-red-500 border border-white/5 transition-all group/remove shrink-0"
                          onClick={(e) => handleDisconnect(player.uid, e)}
                        >
                          <LogOut className="w-4 h-4 rotate-180 transition-transform group-hover/remove:scale-110" />
                        </Button>
                      </div>
                    </div>
                  )}

                  
                  <DialogContent className="sm:max-w-md bg-[#000000] border-white/10 text-white p-0 overflow-hidden rounded-3xl shadow-2xl">
                    <div className="relative h-28 bg-gradient-to-b from-white/[0.03] to-transparent" />
                    <div className="px-8 pb-10 pt-0 -mt-14 relative z-10 text-center">
                      <Avatar className="w-28 h-28 border-[6px] border-black mx-auto mb-4 shadow-xl">
                        <AvatarImage src={player.photoURL} referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-white/5 text-white/10 text-3xl font-bold">
                          {player.displayName?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <h2 className="text-2xl font-black mb-1">{player.displayName}</h2>
                      {player.tournamentReady && (
                        <div className="flex justify-center mb-1">
                          <Badge className="bg-emerald-500 text-white font-black text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5" /> TOURNAMENT READY
                          </Badge>
                        </div>
                      )}
                      {player.username && (
                        <p className="text-blue-400 font-mono text-sm mb-6 font-bold tracking-tight">@{player.username}</p>
                      )}
                      
                      <div className="flex items-center justify-center gap-2 text-[10px] text-white/30 mb-8 font-black uppercase tracking-[0.2em]">
                        <MapPin className="w-3.5 h-3.5 text-white/50" />
                        {player.location || 'Tamil Nadu'}
                      </div>

                      {player.bio && (
                        <p className="text-white/60 mb-10 italic leading-relaxed text-sm font-medium">"{player.bio}"</p>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {user?.uid !== player.uid ? (
                          <>
                            {isConnected(player.uid) ? (
                              <Button 
                                className="bg-emerald-500 text-white hover:bg-red-500 font-black h-12 rounded-2xl transition-all active:scale-95 group/modal-btn"
                                onClick={(e) => handleDisconnect(player.uid, e)}
                              >
                                <span className="group-hover/modal-btn:hidden">Connected</span>
                                <span className="hidden group-hover/modal-btn:inline">Remove</span>
                              </Button>
                            ) : (
                              <Button 
                                className="bg-white text-black hover:bg-white/90 font-black h-12 rounded-2xl transition-all active:scale-95"
                                onClick={(e) => handleConnect(player.uid, e)}
                              >
                                Connect
                              </Button>
                            )}
                            <Link to={`/profile?uid=${player.uid}`} className="w-full">
                              <Button variant="outline" className="w-full bg-transparent border-white/10 text-white/50 hover:text-white font-black h-12 rounded-2xl text-xs uppercase tracking-widest">
                                Profile
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <Link to="/profile" className="w-full col-span-2">
                            <Button className="w-full bg-white text-black font-black h-12 rounded-2xl">
                              My Profile
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center pt-32 px-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Search className="w-6 h-6 text-white/10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-white font-bold">No results found</h3>
              <p className="text-white/30 text-sm">Check spelling for "{searchTerm}"</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
