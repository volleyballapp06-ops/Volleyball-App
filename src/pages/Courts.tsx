import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, OperationType, handleFirestoreError, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, increment, runTransaction, where, deleteDoc } from 'firebase/firestore';
import { MapPin, Star, Search, Filter, Info, Clock, Users, CheckCircle2, XCircle, Plus, Phone, ChevronLeft, ChevronRight, Zap, Trophy, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Court, TeamChallenge } from '../types';
import { calculateDistance, cn } from '../lib/utils';
import { ImageUpload } from '../components/ImageUpload';
import { generateGeohash } from '../lib/geo';
import { ConfirmModal } from '../components/ConfirmModal';

function CourtImageCarousel({ images, name, courtId }: { images: string[], name: string, courtId: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayImages = images?.length > 0 ? images : [`https://picsum.photos/seed/${courtId}/800/600`];

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  return (
    <div className="relative w-full h-full overflow-hidden group/carousel">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={displayImages[currentIndex]}
          alt={`${name} - ${currentIndex + 1}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      
      {displayImages.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
            <button 
              onClick={prevImage}
              className="p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md transition-all border border-white/20 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={nextImage}
              className="p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md transition-all border border-white/20 active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {displayImages.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Courts() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courts, setCourts] = useState<Court[]>([]);
  const [activeMatches, setActiveMatches] = useState<TeamChallenge[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'distance'>('name');
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [isNearbyOnly, setIsNearbyOnly] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; court: Court | null }>({
    isOpen: false,
    court: null
  });
  const [newCourt, setNewCourt] = useState({
    name: '',
    location: '',
    district: 'Chennai',
    type: 'Outdoor' as 'Outdoor' | 'Turf' | 'Indoor',
    access: 'Free' as 'Free' | 'Paid',
    images: [] as string[],
    contact: ''
  });

  const handleRateCourt = async (courtId: string, rating: number) => {
    if (!user) {
      toast.error('Please sign in to rate');
      return;
    }

    try {
      const ratingId = `${user.uid}_${courtId}`;
      const ratingRef = doc(db, 'court_ratings', ratingId);
      
      await runTransaction(db, async (transaction) => {
        const ratingDoc = await transaction.get(ratingRef);
        const courtRef = doc(db, 'courts', courtId);
        const courtDoc = await transaction.get(courtRef);
        
        if (!courtDoc.exists()) {
          throw new Error("Court does not exist!");
        }

        const stats = courtDoc.data().ratingStats || { sum: 0, count: 0 };
        
        if (ratingDoc.exists()) {
          const oldRating = ratingDoc.data().rating;
          transaction.update(courtRef, {
            'ratingStats.sum': stats.sum - oldRating + rating
          });
          transaction.update(ratingRef, {
            rating: rating,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(ratingRef, {
            userId: user.uid,
            courtId: courtId,
            rating: rating,
            createdAt: serverTimestamp()
          });
          transaction.update(courtRef, {
            'ratingStats.sum': stats.sum + rating,
            'ratingStats.count': stats.count + 1
          });
        }
      });
      toast.success(userRatings[courtId] ? 'Rating updated!' : 'Thank you for rating!');
    } catch (error) {
      console.error('Rating failed', error);
      toast.error('Failed to submit rating');
    }
  };

  useEffect(() => {
    // If profile has location, use that as initial location
    if (profile?.lat && profile?.lng && !userLocation) {
      setUserLocation({
        lat: profile.lat,
        lng: profile.lng
      });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setSortBy('distance');
        },
        (error) => {
          console.error("Geolocation error:", error);
          // Fallback already handled by profile check
        }
      );
    }

    const q = query(collection(db, 'courts'), orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court));
      setCourts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courts');
    });

    let unsubscribeRatings: (() => void) | null = null;
    if (user) {
      const ratingsQ = query(collection(db, 'court_ratings'), where('userId', '==', user.uid));
      unsubscribeRatings = onSnapshot(ratingsQ, (snapshot) => {
        const ratings: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          ratings[doc.data().courtId] = doc.data().rating;
        });
        setUserRatings(ratings);
      });
    }

    const matchesQ = query(collection(db, 'teamChallenges'), where('status', '==', 'accepted'));
    const unsubscribeMatches = onSnapshot(matchesQ, (snapshot) => {
      setActiveMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChallenge)));
    });

    return () => {
      unsubscribe();
      if (unsubscribeRatings) unsubscribeRatings();
      unsubscribeMatches();
    };
  }, [user]);

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
        createdBy: user.uid,
        lat,
        lng,
        geohash,
        facilities: ['Standard Court'],
        imageUrl: newCourt.images[0] || `https://picsum.photos/seed/${Date.now()}/800/600`,
        images: newCourt.images,
        contact: newCourt.contact,
        rating: 4.0,
        ratingStats: {
          sum: 0,
          count: 0
        },
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

  const handleUpdateCourt = async () => {
    if (!editingCourt) return;
    if (!editingCourt.name || !editingCourt.location) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { id, ...data } = editingCourt;
      const courtRef = doc(db, 'courts', id);
      await updateDoc(courtRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success('Court updated successfully!');
      setEditingCourt(null);
    } catch (error) {
      console.error('Update failed', error);
      toast.error('Failed to update court');
    }
  };

  const handleDeleteCourt = async (court: Court) => {
    if (!user) return;
    const isAdminUser = profile?.role === 'admin' || user.email === 'volleyballapp06@gmail.com';
    const isOwner = court.createdBy === user.uid;

    if (!isAdminUser && !isOwner) {
      toast.error('You do not have permission to delete this court');
      return;
    }

    setConfirmDelete({ isOpen: true, court });
  };

  const confirmDeleteAction = async () => {
    const court = confirmDelete.court;
    if (!court || !user) return;

    try {
      console.log(`Attempting to delete court: ${court.id}`);
      await deleteDoc(doc(db, 'courts', court.id));
      toast.success('Court deleted successfully');
      if (selectedCourt?.id === court.id) {
        setSelectedCourt(null);
      }
      setConfirmDelete({ isOpen: false, court: null });
    } catch (error) {
      console.error('Delete failed:', error);
      handleFirestoreError(error, OperationType.DELETE, `courts/${court.id}`);
      toast.error('Failed to delete court');
    }
  };

  const filteredCourts = courts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.district.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (isNearbyOnly && userLocation && c.lat && c.lng) {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, c.lat, c.lng);
      return matchesSearch && distance <= 30;
    }
    
    return matchesSearch;
  });

  const sortedCourts = [...filteredCourts].sort((a, b) => {
    if (sortBy === 'distance' && userLocation && a.lat && b.lat) {
      const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-6 md:gap-8 min-h-[calc(100vh-8rem)]">
      {/* Open Runs Integration Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-primary rounded-[2rem] p-6 sm:p-8 text-white shadow-2xl shadow-primary/20"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-primary bg-slate-200" />
                ))}
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">12 Players Active</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter leading-none">Team Challenges <span className="text-white/60">Live Now</span></h2>
            <p className="text-white/80 text-sm sm:text-base font-medium">Find team challenges and friendly matches near you right now.</p>
          </div>
          <Button 
            onClick={() => navigate('/teams')}
            className="w-full md:w-auto bg-white text-primary hover:bg-white/90 font-black px-8 h-12 sm:h-14 rounded-2xl shadow-xl transition-all active:scale-95 text-xs sm:text-base"
          >
            Check Live Challenges
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 ml-2 fill-primary" />
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground uppercase italic">
              Volleyball Courts
            </h1>
            {isNearbyOnly && userLocation && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black animate-pulse">
                30KM RADIUS ACTIVE
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm md:text-base px-1">
            Find and check availability of courts across Tamil Nadu.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Dialog open={isAddingCourt} onOpenChange={setIsAddingCourt}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl active:scale-95 transition-transform")}>
              <Plus className="w-4 h-4 mr-2" /> Add Court
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Volleyball Court</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="court-name-p">Court Name</Label>
                  <Input 
                    id="court-name-p" 
                    placeholder="e.g. YMCA Marina Court" 
                    value={newCourt.name}
                    onChange={(e) => setNewCourt({...newCourt, name: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="court-location-p">Location Address</Label>
                  <Input 
                    id="court-location-p" 
                    placeholder="e.g. Marina Beach, Chennai" 
                    value={newCourt.location}
                    onChange={(e) => setNewCourt({...newCourt, location: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="court-district-p">District</Label>
                  <Input 
                    id="court-district-p" 
                    placeholder="e.g. Chennai" 
                    value={newCourt.district}
                    onChange={(e) => setNewCourt({...newCourt, district: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="court-contact-p">Contact Number (Owner)</Label>
                  <Input 
                    id="court-contact-p" 
                    placeholder="e.g. +91 98765 43210" 
                    value={newCourt.contact}
                    onChange={(e) => setNewCourt({...newCourt, contact: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Court Type</Label>
                    <Select 
                      value={newCourt.type} 
                      onValueChange={(val: any) => setNewCourt({...newCourt, type: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Outdoor">Outdoor</SelectItem>
                        <SelectItem value="Turf">Turf</SelectItem>
                        <SelectItem value="Indoor">Indoor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Access</Label>
                    <Select 
                      value={newCourt.access} 
                      onValueChange={(val: any) => setNewCourt({...newCourt, access: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select access" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Free">Free</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Court Images</Label>
                  <ImageUpload 
                    onImagesChange={(urls) => setNewCourt({...newCourt, images: urls})}
                    initialImages={newCourt.images}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCourt} className="w-full bg-primary text-white font-bold">
                  Add Court
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant={isNearbyOnly ? "default" : "outline"}
              className={cn(
                "h-11 rounded-xl font-bold transition-all whitespace-nowrap px-4",
                isNearbyOnly ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "border-emerald-500/20 text-emerald-600 hover:bg-emerald-50"
              )}
              onClick={() => setIsNearbyOnly(!isNearbyOnly)}
            >
              <Zap className={cn("w-4 h-4 mr-2", isNearbyOnly && "fill-white")} />
              {isNearbyOnly ? 'Showing Nearby' : 'Show Nearby'}
            </Button>
            
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search courts..." 
                className="pl-10 bg-white border-border focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-[140px] bg-white border-border">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                {userLocation && <SelectItem value="distance">Nearest First</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-80 bg-muted rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredCourts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCourts.map((court, index) => (
            <motion.div
              key={court.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="clean-card group hover:border-primary/50 transition-all overflow-hidden p-0">
                <div className="h-48 relative overflow-hidden">
                  <CourtImageCarousel 
                    images={court.images || []} 
                    name={court.name} 
                    courtId={court.id} 
                  />
                  <div className="absolute bottom-4 left-4 z-10">
                    <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-primary text-sm font-bold shadow-sm">
                      <Star className="w-4 h-4 fill-primary" />
                      {court.ratingStats && court.ratingStats.count > 0 
                        ? (court.ratingStats.sum / court.ratingStats.count).toFixed(1)
                        : (court.rating || '4.5')}
                      {court.ratingStats && court.ratingStats.count > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                          ({court.ratingStats.count})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-[18px] font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{court.name}</h3>
                    {userLocation && court.lat && court.lng && (
                      <Badge className="bg-emerald-50 text-emerald-600 border-none text-[11px] font-extrabold shrink-0">
                        {calculateDistance(userLocation.lat, userLocation.lng, court.lat, court.lng).toFixed(1)} km
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-[13px] mb-4">
                    <MapPin className="w-4 h-4 text-primary" />
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(court.name + ' ' + court.location + ' ' + court.district)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary hover:underline transition-all"
                    >
                      {court.location}, {court.district}
                    </a>
                  </div>

                  <div className="flex gap-2 mb-4 text-[11px] font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-tighter">
                      {court.type || 'Outdoor'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border uppercase tracking-tighter ${court.access === 'Paid' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      {court.access || 'Free'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {(court.facilities || ['Standard Court', 'Changing Room', 'Parking']).map(facility => (
                      <Badge key={facility} variant="secondary" className="bg-muted text-muted-foreground border-none text-[10px] font-bold uppercase tracking-wider">
                        {facility}
                      </Badge>
                    ))}
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3 mb-6">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {userRatings[court.id] ? `Your Rating: ${userRatings[court.id]} ★` : 'Rate this court'}
                    </p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleRateCourt(court.id, s)}
                          className="hover:scale-110 transition-transform focus:outline-none"
                        >
                          <Star className={cn(
                            "w-5 h-5 transition-colors",
                            s <= (userRatings[court.id] || 0) 
                              ? "text-yellow-400 fill-yellow-400" 
                              : "text-slate-300 hover:text-yellow-400 fill-transparent hover:fill-yellow-400"
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-lg"
                      onClick={() => setSelectedCourt(court)}
                    >
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="border-border hover:bg-muted text-foreground font-bold h-11 w-11 rounded-lg"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(court.name + ' ' + court.location + ' ' + court.district)}`, '_blank')}
                    >
                      <MapPin className="w-5 h-5" />
                    </Button>
                    {court.contact && (
                      <a 
                        href={`tel:${court.contact.replace(/\s+/g, '')}`}
                        className={cn(buttonVariants({ variant: "default" }), "bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 w-11 p-0 rounded-lg")}
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  {user && (user.uid === court.createdBy || profile?.role === 'admin' || user.email === 'volleyballapp06@gmail.com') && (
                    <div className="mt-4 pt-4 border-t border-border flex gap-2">
                      {user.uid === court.createdBy && (
                        <Dialog open={editingCourt?.id === court.id} onOpenChange={(open) => setEditingCourt(open ? court : null)}>
                          <DialogTrigger 
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "flex-1 font-bold border-primary text-primary hover:bg-primary/5 h-10"
                            )}
                          >
                            Edit Details
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Court Details</DialogTitle>
                            </DialogHeader>
                            {editingCourt && (
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-name">Court Name</Label>
                                  <Input 
                                    id="edit-name" 
                                    value={editingCourt.name}
                                    onChange={(e) => setEditingCourt({...editingCourt, name: e.target.value})}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-location">Location Address</Label>
                                  <Input 
                                    id="edit-location" 
                                    value={editingCourt.location}
                                    onChange={(e) => setEditingCourt({...editingCourt, location: e.target.value})}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-district">District</Label>
                                  <Input 
                                    id="edit-district" 
                                    value={editingCourt.district}
                                    onChange={(e) => setEditingCourt({...editingCourt, district: e.target.value})}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-contact">Contact Number</Label>
                                  <Input 
                                    id="edit-contact" 
                                    value={editingCourt.contact || ''}
                                    onChange={(e) => setEditingCourt({...editingCourt, contact: e.target.value})}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Court Images</Label>
                                  <ImageUpload 
                                    initialImages={editingCourt.images || []}
                                    onImagesChange={(urls) => setEditingCourt({
                                      ...editingCourt, 
                                      images: urls, 
                                      imageUrl: urls[0] || (editingCourt.imageUrl || '')
                                    })}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label>Type</Label>
                                    <Select 
                                      value={editingCourt.type} 
                                      onValueChange={(val: any) => setEditingCourt({...editingCourt, type: val})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Outdoor">Outdoor</SelectItem>
                                        <SelectItem value="Turf">Turf</SelectItem>
                                        <SelectItem value="Indoor">Indoor</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Access</Label>
                                    <Select 
                                      value={editingCourt.access} 
                                      onValueChange={(val: any) => setEditingCourt({...editingCourt, access: val})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Free">Free</SelectItem>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button onClick={handleUpdateCourt} className="w-full bg-primary text-white font-bold">
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      {(user.uid === court.createdBy || profile?.role === 'admin' || user.email === 'volleyballapp06@gmail.com') && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-10 w-10 text-red-500 hover:text-white hover:bg-red-500 border border-red-500/10 transition-all rounded-lg shrink-0"
                          onClick={() => handleDeleteCourt(court)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border px-6">
          <MapPin className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground uppercase">No courts found {isNearbyOnly ? 'nearby' : ''}</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mb-6">
            {isNearbyOnly 
              ? "There are no volleyball courts within 30km of your location in our database yet."
              : "Try searching for something else or check back later."}
          </p>
          {isNearbyOnly && (
            <Button 
              variant="outline" 
              className="rounded-xl font-bold border-primary text-primary hover:bg-primary/5"
              onClick={() => setIsNearbyOnly(false)}
            >
              Show All Courts in Tamil Nadu
            </Button>
          )}
        </div>
      )}

      <Dialog open={!!selectedCourt} onOpenChange={(open) => !open && setSelectedCourt(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedCourt && (
            <div className="flex flex-col h-full max-h-[90vh] overflow-y-auto">
              {/* Header Carousel */}
              <div className="h-64 sm:h-96 w-full relative">
                <CourtImageCarousel 
                  images={selectedCourt.images || []} 
                  name={selectedCourt.name} 
                  courtId={selectedCourt.id} 
                />
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-white/90 backdrop-blur-md text-primary font-bold shadow-lg py-1.5 px-3 flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-primary" />
                    {selectedCourt.ratingStats && selectedCourt.ratingStats.count > 0 
                      ? (selectedCourt.ratingStats.sum / selectedCourt.ratingStats.count).toFixed(1)
                      : (selectedCourt.rating || '4.5')}
                  </Badge>
                </div>
              </div>

               {/* Content */}
              <div className="p-6 sm:p-8 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-foreground leading-tight uppercase tracking-tight">{selectedCourt.name}</h2>
                    <div className="flex items-center gap-2 text-muted-foreground font-medium">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{selectedCourt.location}, {selectedCourt.district}</span>
                    </div>
                  </div>
                  {userLocation && selectedCourt.lat && selectedCourt.lng && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-base font-black px-4 py-1 self-start">
                      {calculateDistance(userLocation.lat, userLocation.lng, selectedCourt.lat, selectedCourt.lng).toFixed(1)} km away
                    </Badge>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 p-4 bg-muted rounded-2xl border border-border text-center">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Environment</div>
                    <div className="font-black text-foreground uppercase">{selectedCourt.type}</div>
                  </div>
                  <div className="flex-1 p-4 bg-muted rounded-2xl border border-border text-center">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Access Tier</div>
                    <div className={cn(
                      "font-black uppercase",
                      selectedCourt.access === 'Paid' ? "text-orange-600" : "text-emerald-600"
                    )}>{selectedCourt.access}</div>
                  </div>
                </div>

                <section>
                  <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Core Facilities</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(selectedCourt.facilities || ['Standard Court', 'Changing Room', 'Parking', 'Mineral Water']).map((facility, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-sm transition-all hover:shadow-md">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-foreground">{facility}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-muted/50 rounded-[2rem] p-6 border border-border/50">
                  <div className="flex items-center gap-3 mb-6">
                    <Trophy className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-black italic uppercase text-primary">Scheduled Matches</h4>
                      <p className="text-xs text-muted-foreground font-medium">Friendly matches organized by local teams.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {activeMatches.filter(m => m.courtId === selectedCourt.id).length > 0 ? (
                      activeMatches.filter(m => m.courtId === selectedCourt.id).map(match => (
                        <div key={match.id} className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                          <div className="flex-1 text-center">
                            <p className="text-sm font-bold truncate">{match.fromTeamName}</p>
                          </div>
                          <div className="px-4 text-primary font-black italic text-xs">VS</div>
                          <div className="flex-1 text-center">
                            <p className="text-sm font-bold truncate">{match.toTeamName}</p>
                          </div>
                          <div className="ml-4 pl-4 border-l border-border text-right max-w-[100px]">
                            <p className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">
                              {new Date(match.scheduledDate).toLocaleDateString()}
                            </p>
                            <p className="text-[11px] font-bold text-foreground leading-none">
                              {new Date(match.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground italic font-medium">No matches scheduled at this court.</p>
                        <Button 
                          variant="link" 
                          className="text-xs text-primary font-bold mt-1"
                          onClick={() => navigate('/teams')}
                        >
                          Challenge another team to play here
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                {selectedCourt.contact && (
                  <section className="bg-primary rounded-3xl p-6 text-white shadow-xl shadow-primary/20">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="text-center sm:text-left space-y-1">
                        <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Official Contact</p>
                        <h4 className="text-2xl font-black">{selectedCourt.contact}</h4>
                      </div>
                      <a 
                        href={`tel:${selectedCourt.contact.replace(/\s+/g, '')}`}
                        className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto bg-white text-primary hover:bg-white/90 font-black px-8 h-12 rounded-xl group")}
                      >
                        <Phone className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                        Call Now
                      </a>
                    </div>
                  </section>
                )}

                <div className="flex gap-4 pt-4">
                  <Button 
                    className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-black h-14 rounded-2xl shadow-xl shadow-foreground/10"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCourt.name + ' ' + selectedCourt.location + ' ' + selectedCourt.district)}`, '_blank')}
                  >
                    <MapPin className="w-5 h-5 mr-3" />
                    Open in Maps
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-border text-foreground hover:bg-muted font-black h-14 rounded-2xl"
                    onClick={() => setSelectedCourt(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Court"
        description={`Are you sure you want to delete ${confirmDelete.court?.name}? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete({ isOpen: false, court: null })}
      />
    </div>
  );
}
