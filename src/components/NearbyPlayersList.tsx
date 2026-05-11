import React, { useEffect, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { calculateDistance, formatDistance, getCurrentPosition } from '../lib/geo';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NearbyPlayersList() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocation = async () => {
      // Use profile as initial fallback
      if (profile?.lat && profile?.lng) {
        setUserLocation({ lat: profile.lat, lng: profile.lng });
      }

      try {
        const pos = await getCurrentPosition();
        setUserLocation(pos);
      } catch (err) {
        console.error('Failed to get location', err);
      }
    };
    fetchLocation();
  }, [profile]);

  useEffect(() => {
    const q = query(collection(db, 'users'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setPlayers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const nearbyPlayers = players
    .filter(p => p.lat && p.lng && userLocation && p.uid !== profile?.uid)
    .map(p => ({
      ...p,
      distance: userLocation ? calculateDistance(userLocation, { lat: p.lat!, lng: p.lng! }) : Infinity
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  if (loading) return <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-xl" />)}
  </div>;

  if (nearbyPlayers.length === 0) return (
    <div className="text-center py-6 bg-muted/30 rounded-xl border border-dashed border-border">
      <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">No players found nearby.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {nearbyPlayers.map((player) => (
        <Link 
          key={player.uid} 
          to={`/profile?uid=${player.uid}`}
          className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-xl transition-colors group"
        >
          <Avatar className="w-10 h-10 border border-border group-hover:border-primary/30 transition-colors">
            <AvatarImage src={player.photoURL || undefined} referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {player.displayName?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{player.displayName}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
              <MapPin className="w-3 h-3 text-primary" />
              {player.location ? `${player.location} • ` : ''}
              <span className="text-primary">{formatDistance(player.distance)} away</span>
            </div>
          </div>
        </Link>
      ))}
      <Link to="/players">
        <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground hover:text-primary">
          View All Players
        </Button>
      </Link>
    </div>
  );
}
