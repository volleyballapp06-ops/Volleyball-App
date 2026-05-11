import React, { useEffect, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
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
  connections?: string[];
  stats: {
    tournamentMatches: number;
    friendlyMatches: number;
    wins: number;
  };
}

interface ConnectionRequest {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export default function Players() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'connections' | 'requests'>('discover');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [connectionsList, setConnectionsList] = useState<PlayerProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
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
    // Standard background
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

    // Subscribe to connection requests
    let unsubRequests: () => void = () => {};
    if (user) {
      const qRequests = query(
        collection(db, 'connection_requests'),
        where('status', '==', 'pending')
      );
      
      unsubRequests = onSnapshot(qRequests, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectionRequest));
        setSentRequests(reqs.filter(r => r.fromId === user.uid));
        setReceivedRequests(reqs.filter(r => r.toId === user.uid));
      });
    }

    return () => {
      unsubscribe();
      unsubRequests();
    };
  }, [user, profile]);

  const handleConnect = async (targetPlayer: PlayerProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !profile) {
      toast.error('Please sign in to connect with players');
      return;
    }

    // Check if already connected or has pending request
    if (isConnected(targetPlayer.uid)) return;
    if (sentRequests.some(r => r.toId === targetPlayer.uid)) return;

    try {
      // Create the request
      const requestRef = await addDoc(collection(db, 'connection_requests'), {
        fromId: user.uid,
        fromName: profile.displayName,
        toId: targetPlayer.uid,
        toName: targetPlayer.displayName,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send notification to the recipient
      await addDoc(collection(db, 'notifications'), {
        userId: targetPlayer.uid,
        title: 'Connection Invitation',
        message: `${profile.displayName} wants to connect with you.`,
        type: 'match',
        link: `/players`,
        connectionRequestId: requestRef.id,
        createdAt: serverTimestamp(),
        read: false
      });

      toast.success('Connection request sent!');
    } catch (error) {
      console.error('Connection request failed:', error);
      toast.error('Failed to send request');
    }
  };

  const handleRequestAction = async (request: ConnectionRequest, action: 'accepted' | 'rejected', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'connection_requests', request.id);
      
      if (action === 'accepted') {
        // Update both users connections
        const fromUserRef = doc(db, 'users', request.fromId);
        const toUserRef = doc(db, 'users', request.toId);
        
        batch.update(fromUserRef, { connections: arrayUnion(request.toId) });
        batch.update(toUserRef, { connections: arrayUnion(request.fromId) });
        
        // Notify the sender
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: request.fromId,
          title: 'Connection Accepted!',
          message: `${request.toName} accepted your invitation. You are now connected!`,
          type: 'success',
          link: `/players`,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      batch.update(requestRef, { 
        status: action,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast.success(`Request ${action}`);
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      toast.error(`Error processing request`);
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
    if (activeTab === 'requests') return []; // Handled separately
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
    <div className="flex flex-col gap-6 md:gap-8 pb-12">
      {/* Top Search & Filter Bar */}
      <div className="bg-card border rounded-[2rem] p-4 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder={activeTab === 'discover' ? "Search for players..." : `Search in ${activeTab}...`} 
              className="w-full pl-12 pr-10 h-12 bg-muted/30 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl transition-all",
                showNearby ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 scale-105" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50"
              )}
              onClick={toggleNearby}
              disabled={isLocating}
            >
              <MapPin className={cn("w-4 h-4", isLocating && "animate-pulse")} />
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              className={cn(
                "h-12 flex-1 md:flex-none px-6 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all",
                showTournamentReadyOnly 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setShowTournamentReadyOnly(!showTournamentReadyOnly)}
            >
              <Trophy className={cn("w-4 h-4 mr-2", showTournamentReadyOnly && "fill-current")} />
              Pro Ready
            </Button>

            <div className="flex bg-muted/30 p-1 rounded-2xl border border-border/50 flex-1 md:flex-none">
              {[
                { id: 'discover', label: 'Explore', icon: Search },
                { id: 'connections', label: 'Circle', icon: UserCheck },
                { id: 'requests', label: 'Requests', icon: Bell }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative",
                    activeTab === tab.id 
                      ? "bg-white text-primary shadow-sm ring-1 ring-black/5" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === 'requests' && receivedRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] flex items-center justify-center rounded-full border border-background animate-pulse">
                      {receivedRequests.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section for Connections - RE-BRANDED AS "MY CIRCLE" */}
      {activeTab === 'connections' && !loading && (
        <section className="bg-card border rounded-[2rem] p-8 shadow-xl shadow-emerald-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000 -rotate-12 group-hover:rotate-0">
            <UserCheck className="w-48 h-48 text-emerald-500" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left space-y-1">
              <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic mb-1">
                My <span className="text-emerald-500">Circle</span>
              </h1>
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em]">
                {connectionsList.length} VERIFIED ATHLETES IN YOUR NETWORK
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSortBy('name')}
                  className={cn(
                    "h-10 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", 
                    sortBy === 'name' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "border-border text-muted-foreground"
                  )}
                >
                  Sort by Name
                </Button>
            </div>
          </div>
        </section>
      )}

      {/* Results List / Grid */}
      <div className={cn(
        "transition-all duration-500 ease-in-out",
        (activeTab === 'connections' || activeTab === 'requests') && displayedList.length > 0 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"
      )}>
        {loading ? (
          <div className="col-span-full space-y-4 pt-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card border rounded-[2rem] p-6 animate-pulse flex items-center gap-4">
                <div className="w-16 h-16 bg-muted rounded-2xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'requests' ? (
          /* Connection Requests List */
          <AnimatePresence mode="popLayout">
            {receivedRequests.length > 0 ? (
              receivedRequests.map((req, index) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border rounded-[2rem] p-6 shadow-sm flex flex-col items-center text-center gap-4 group"
                >
                  <Avatar className="w-16 h-16 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
                      {req.fromName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-black text-foreground uppercase italic tracking-tight">{req.fromName}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Invited you to connect</p>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    <Button 
                      className="flex-1 h-11 rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
                      onClick={(e) => handleRequestAction(req, 'accepted', e)}
                    >
                      Accept
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 h-11 rounded-xl border-border text-muted-foreground font-black uppercase text-[10px] tracking-widest hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                      onClick={(e) => handleRequestAction(req, 'rejected', e)}
                    >
                      Not Now
                    </Button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-muted/20 border-2 border-dashed border-muted rounded-[3rem]">
                <Bell className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm font-bold text-muted-foreground">No pending invitations</p>
              </div>
            )}
          </AnimatePresence>
        ) : displayedList.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {displayedList.map((player, index) => (
              <motion.div
                key={player.uid}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ delay: index * 0.03 }}
              >
                <Dialog>
                  {activeTab === 'discover' ? (
                    /* Row Style for Discover */
                    <div className="bg-card border rounded-[1.5rem] p-4 hover:border-primary/30 transition-all group/row flex items-center gap-4">
                      <DialogTrigger className="flex flex-1 items-center gap-4 text-left outline-none cursor-pointer">
                        <Avatar className="w-14 h-14 rounded-2xl border border-border group-hover/row:scale-105 transition-transform duration-500">
                          <AvatarImage src={player.photoURL || undefined} referrerPolicy="no-referrer" />
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                            {player.displayName?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-black text-foreground truncate text-[15px] tracking-tight group-hover/row:text-primary transition-colors uppercase italic">
                              {player.displayName}
                            </p>
                            {player.tournamentReady && (
                              <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate font-bold uppercase tracking-wider flex items-center gap-2">
                             <MapPin className="w-3 h-3" />
                             {player.location || 'Tamil Nadu'}
                             {showNearby && userLocation && player.lat && player.lng && (
                               <span className="text-emerald-500 font-black ml-1">
                                 {formatDistance(calculateDistance(userLocation, { lat: player.lat, lng: player.lng }))}
                               </span>
                             )}
                          </p>
                        </div>
                      </DialogTrigger>

                      <div className="flex items-center gap-2">
                        {isConnected(player.uid) ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-10 rounded-xl text-[9px] font-black uppercase tracking-widest text-emerald-600 border-emerald-500/20 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all group/btn"
                            onClick={(e) => handleDisconnect(player.uid, e)}
                          >
                            <span className="group-hover/btn:hidden flex items-center gap-1.5"><Check className="w-3 h-3" /> Circle</span>
                            <span className="hidden group-hover/btn:inline">Remove</span>
                          </Button>
                        ) : sentRequests.some(r => r.toId === player.uid) ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled
                            className="h-10 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary/60 border-primary/20 bg-primary/5 italic"
                          >
                            <Clock className="w-3 h-3 mr-1.5 animate-pulse" /> Pending
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className={cn(
                              "h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                              player.uid === user?.uid ? "hidden" : "text-muted-foreground hover:text-primary hover:border-primary/30"
                            )}
                            onClick={(e) => handleConnect(player, e)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Grid Style for "Circle" (Connections) - LUXURY LIGHT STYLE */
                    <div className="bg-card border border-border/50 hover:border-emerald-500/30 rounded-[2.5rem] p-6 text-center group/card transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden flex flex-col h-full">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:rotate-12 transition-transform">
                        <UserCheck className="w-12 h-12 text-emerald-500" />
                      </div>

                      <DialogTrigger className="flex flex-col items-center outline-none mb-6">
                        <div className="relative mb-5 group-hover/card:scale-110 transition-transform duration-700">
                          <Avatar className="w-24 h-24 rounded-3xl border-4 border-white shadow-xl relative z-10">
                            <AvatarImage src={player.photoURL || undefined} referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-muted text-muted-foreground font-black text-2xl">
                              {player.displayName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white w-8 h-8 rounded-2xl border-4 border-card flex items-center justify-center z-20 shadow-lg">
                            <Check className="w-3.5 h-3.5 stroke-[4]" />
                          </div>
                        </div>

                        <h3 className="font-black text-foreground text-lg tracking-tight uppercase italic group-hover/card:text-emerald-600 transition-colors mb-1">{player.displayName}</h3>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{player.location || 'Verified Athlete'}</p>
                      </DialogTrigger>

                      <div className="mt-auto pt-6 border-t border-border/50 flex gap-2">
                        <Button
                          variant="ghost" 
                          className="flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-10 hover:bg-primary/10 hover:text-primary transition-all"
                          asChild
                        >
                          <Link to={`/profile?uid=${player.uid}`}>Profile</Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
                          onClick={(e) => handleDisconnect(player.uid, e)}
                        >
                          <LogOut className="w-4 h-4 rotate-180" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5 p-8 pt-12 text-center">
                      <Avatar className="w-32 h-32 rounded-[2rem] border-8 border-card shadow-2xl mx-auto mb-6 transform group-hover:scale-105 transition-transform duration-700">
                        <AvatarImage src={player.photoURL || undefined} referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold text-4xl">
                          {player.displayName?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase italic mb-2">{player.displayName}</h2>
                      
                      <div className="flex flex-wrap justify-center gap-2 mb-6">
                        <Badge className="bg-muted text-muted-foreground border-none font-black text-[9px] uppercase tracking-widest px-3">
                          {player.role}
                        </Badge>
                        {player.tournamentReady && (
                          <Badge className="bg-emerald-500 text-white border-none font-black text-[9px] uppercase tracking-widest px-3 flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current" /> Tournament Ready
                          </Badge>
                        )}
                      </div>

                      {player.bio && (
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed italic mb-8 px-6">
                          "{player.bio}"
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        {isConnected(player.uid) ? (
                          <Button 
                            variant="outline"
                            className="h-14 rounded-2xl font-black uppercase tracking-widest border-red-200 text-red-500 hover:bg-red-50"
                            onClick={(e) => handleDisconnect(player.uid, e)}
                          >
                            Disconnect
                          </Button>
                        ) : sentRequests.some(r => r.toId === player.uid) ? (
                          <Button 
                            disabled
                            className="h-14 rounded-2xl font-black uppercase tracking-widest bg-primary/20 text-primary border-none italic"
                          >
                            Request Pending
                          </Button>
                        ) : player.uid !== user?.uid && (
                          <Button 
                             className="h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 bg-primary text-white hover:bg-primary/90"
                             onClick={(e) => handleConnect(player, e)}
                           >
                             Connect
                           </Button>
                        )}
                        <Button 
                          variant="outline" 
                          className={cn(
                            "h-14 rounded-2xl font-black uppercase tracking-widest border-border hover:bg-muted text-foreground",
                            player.uid === user?.uid || isConnected(player.uid) || sentRequests.some(r => r.toId === player.uid) ? "col-span-2" : ""
                          )}
                          asChild
                        >
                          <Link to={`/profile?uid=${player.uid}`}>View Profile</Link>
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card border rounded-[3rem] border-dashed">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Search className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">No players found</h3>
            <p className="text-muted-foreground text-sm font-medium max-w-xs text-center">
              Try adjusting your search filters or browse other regions around Tamil Nadu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
