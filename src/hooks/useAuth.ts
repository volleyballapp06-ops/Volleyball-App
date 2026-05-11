import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Activity Heartbeat
  useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          lastActive: serverTimestamp()
        });
      } catch (error) {
        console.error('Presence update failed', error);
      }
    };

    // Update once on mount/auth change
    updatePresence();

    // Then update every 2 minutes
    const interval = setInterval(updatePresence, 120000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Check if profile exists, if not create it
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Anonymous Player',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            role: 'player',
            stats: {
              tournamentMatches: 0,
              friendlyMatches: 0,
              wins: 0
            }
          };
          await setDoc(userDocRef, {
            ...newProfile,
            createdAt: serverTimestamp()
          });
        }

        // Listen for real-time updates
        unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return { user, profile, loading };
}
