import React, { useEffect, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch, serverTimestamp, getDocs, limit, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { AppNotification, Tournament } from '../types';
import { Bell, BellOff, X, Check, ExternalLink, Info, Trophy, MapPin, Trash2, UserCheck, UserX } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { calculateDistance, getCurrentPosition } from '../lib/geo';
import { toast } from 'sonner';
import { arrayUnion } from 'firebase/firestore';

export default function NotificationCenter() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleConnectionRequest = async (notif: AppNotification, action: 'accepted' | 'rejected') => {
    if (!user || !notif.connectionRequestId) return;
    
    setProcessingId(notif.id);
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'connection_requests', notif.connectionRequestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        toast.error('Request no longer exists');
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
        return;
      }

      const requestData = requestSnap.data();
      if (requestData.status !== 'pending') {
        toast.info('Request has already been processed');
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
        return;
      }

      if (action === 'accepted') {
        // Update both users connections
        const fromUserRef = doc(db, 'users', requestData.fromId);
        const toUserRef = doc(db, 'users', requestData.toId);
        
        batch.update(fromUserRef, { connections: arrayUnion(requestData.toId) });
        batch.update(toUserRef, { connections: arrayUnion(requestData.fromId) });
        
        // Notify the sender
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: requestData.fromId,
          title: 'Connection Accepted!',
          message: `${requestData.toName} accepted your invitation. You are now connected!`,
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

      // Mark notification as read
      batch.update(doc(db, 'notifications', notif.id), { read: true });

      await batch.commit();
      toast.success(`Connection ${action}`);
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      toast.error(`Error processing request`);
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      // Sort in memory to avoid composite index requirement
      const sorted = data.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });

      // Handle native push if enabled and it's a NEW notification
      if (Notification.permission === 'granted' && !loading) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const notif = change.doc.data() as AppNotification;
            // Only notify if it was created very recently (within 30 seconds) to avoid spam on initial load
            const now = new Date().getTime();
            const created = notif.createdAt?.toDate?.()?.getTime() || now;
            if (now - created < 30000) {
              new Notification(notif.title, {
                body: notif.message,
                icon: '/logo.png'
              });
            }
          }
        });
      }

      setNotifications(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user, loading]);

  // Scanner for new tournaments and nearby matches
  useEffect(() => {
    if (!user || !profile) return;

    const scanForTournaments = async () => {
      try {
        // Query tournaments created recently (e.g. last 24h)
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);

        const q = query(
          collection(db, 'tournaments'),
          where('createdAt', '>=', dayAgo),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const newTournaments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));

        // Check each if it's relevant to user
        for (const t of newTournaments) {
          // Rule: If in same location (e.g. Tamil Nadu) OR nearby (if user has coords)
          let isRelevant = false;
          let distanceStr = "";

          if (profile.location && t.location.toLowerCase().includes(profile.location.toLowerCase())) {
            isRelevant = true;
          }

          if (profile.lat && profile.lng && (t as any).lat && (t as any).lng) {
            const dist = calculateDistance(
              { lat: profile.lat, lng: profile.lng },
              { lat: (t as any).lat, lng: (t as any).lng }
            );
            if (dist < 50) { // 50km radius
              isRelevant = true;
              distanceStr = ` (${dist.toFixed(1)}km away)`;
            }
          }

          if (isRelevant) {
            const notifId = `notif_t_${t.id}_${user.uid}`;
            const notifRef = doc(db, 'notifications', notifId);
            
            try {
              const docSnap = await getDoc(notifRef);
              if (!docSnap.exists()) {
                await writeBatch(db).set(notifRef, {
                  userId: user.uid,
                  title: 'New Tournament Announced!',
                  message: `"${t.name}" is happening in ${t.location}${distanceStr}.`,
                  type: 'tournament',
                  read: false,
                  link: `/tournaments?id=${t.id}`,
                  createdAt: serverTimestamp()
                }).commit();
                toast.info(`New Tournament: ${t.name}`, {
                  description: `Happening in ${t.location}`
                });
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
      } catch (err) {
        console.error('Notification scanner error:', err);
      }
    };

    const scanForMatches = async () => {
      try {
        const inTwoHours = new Date();
        inTwoHours.setHours(inTwoHours.getHours() + 2);

        // Query accepted challenges starting soon
        const q = query(
          collection(db, 'teamChallenges'),
          where('scheduledDate', '>=', new Date().toISOString()),
          where('status', '==', 'accepted'),
          limit(20)
        );

        const snapshot = await getDocs(q);
        const upcomingMatches = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

        for (const match of upcomingMatches) {
          let isNearby = false;
          let distanceStr = "";

          // Simple location match for now
          if (profile.location && match.location && match.location.toLowerCase().includes(profile.location.toLowerCase())) {
            isNearby = true;
          }

          if (isNearby) {
            const notifId = `notif_match_${match.id}_${user.uid}`;
            const notifRef = doc(db, 'notifications', notifId);
            
            try {
              const docSnap = await getDoc(notifRef);
              if (!docSnap.exists()) {
                await writeBatch(db).set(notifRef, {
                  userId: user.uid,
                  title: 'Friendly Match Nearby!',
                  message: `${match.fromTeamName} vs ${match.toTeamName} starting soon at ${match.location}.`,
                  type: 'match',
                  read: false,
                  link: `/teams`,
                  createdAt: serverTimestamp()
                }).commit();
                
                toast.info(`Match Nearby: ${match.fromTeamName} vs ${match.toTeamName}`, {
                  description: `Starting soon at ${match.location}`
                });
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
      } catch (err) {
        console.error('Match scanner error:', err);
      }
    };

    scanForTournaments();
    scanForMatches();
  }, [user, profile]); // Only run when user/profile loads

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'tournament': return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'match': return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'success': return <Check className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        variant="ghost" 
        size="icon" 
        className="relative rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
      >
        <Bell className={cn("w-5 h-5", unreadCount > 0 && "animate-pulse")} />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold border-2 border-background animate-in zoom-in"
          >
            {unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl border-border bg-background shadow-2xl overflow-hidden" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-bold">
                {unreadCount} New
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:text-primary" 
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={clearAll}
              title="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-4 transition-colors relative group",
                    !notif.read ? "bg-primary/5" : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 shrink-0 p-2 rounded-xl bg-background border border-border shadow-sm">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-xs font-bold leading-none", !notif.read ? "text-foreground" : "text-muted-foreground")}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(notif.createdAt?.toDate ? notif.createdAt.toDate() : new Date(), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                      
                      {notif.connectionRequestId && !notif.read && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3 gap-1"
                            onClick={() => handleConnectionRequest(notif, 'accepted')}
                            disabled={processingId === notif.id}
                          >
                            <UserCheck className="w-3 h-3" /> Accept
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 rounded-lg border-red-200 text-red-500 hover:bg-red-50 font-bold text-[10px] px-3 gap-1"
                            onClick={() => handleConnectionRequest(notif, 'rejected')}
                            disabled={processingId === notif.id}
                          >
                            <UserX className="w-3 h-3" /> Decline
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {!notif.read && (
                          <Button 
                            variant="link" 
                            className="p-0 h-auto text-[10px] font-bold text-primary" 
                            onClick={() => markAsRead(notif.id)}
                          >
                            Mark read
                          </Button>
                        )}
                        {notif.link && (
                          <Link 
                            to={notif.link} 
                            onClick={() => {
                              markAsRead(notif.id);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                      onClick={() => deleteNotification(notif.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <BellOff className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm">All caught up!</p>
                <p className="text-[11px] text-muted-foreground">No new notifications at the moment.</p>
              </div>
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t border-border bg-muted/10 text-center">
          <Link to="/settings" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors">
            Notification Settings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
