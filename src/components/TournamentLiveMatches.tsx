import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { TournamentMatch } from '../types';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Activity, Trophy, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TournamentLiveMatchesProps {
  tournamentId: string;
}

export default function TournamentLiveMatches({ tournamentId }: TournamentLiveMatchesProps) {
  const [liveMatches, setLiveMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We first need to find the bracket for this tournament
    const findBracket = async () => {
      const q = query(collection(db, 'brackets'), where('tournamentId', '==', tournamentId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const bracketId = snapshot.docs[0].id;
        const matchesQ = query(
          collection(db, `brackets/${bracketId}/matches`),
          where('status', '==', 'ongoing')
        );

        return onSnapshot(matchesQ, (mSnapshot) => {
          const matches = mSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentMatch));
          setLiveMatches(matches);
          setLoading(false);
        });
      } else {
        setLoading(false);
        return () => {};
      }
    };

    let unsubscribe: () => void = () => {};
    findBracket().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => unsubscribe();
  }, [tournamentId]);

  if (loading) return null;
  if (liveMatches.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-primary animate-pulse" />
        <h3 className="text-sm font-black uppercase tracking-widest italic">Live Feed</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {liveMatches.map((match) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border-2 border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5"
          >
            <div className="flex items-center justify-between mb-4">
              <Badge className="bg-primary text-white text-[9px] font-black uppercase">Ongoing</Badge>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold">
                <Clock className="w-3 h-3" />
                Live update
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center">
                <p className="text-[11px] font-black text-foreground truncate mb-2">{match.teamAName}</p>
                <div className="text-3xl font-black text-primary">{match.currentSetPoints?.scoreA ?? 0}</div>
                <div className="text-[10px] font-bold text-muted-foreground mt-1">
                  Sets: {match.scoreA ?? 0}
                </div>
              </div>

              <div className="text-xl font-black text-muted-foreground italic opacity-20">VS</div>

              <div className="flex-1 text-center">
                <p className="text-[11px] font-black text-foreground truncate mb-2">{match.teamBName}</p>
                <div className="text-3xl font-black text-primary">{match.currentSetPoints?.scoreB ?? 0}</div>
                <div className="text-[10px] font-bold text-muted-foreground mt-1">
                  Sets: {match.scoreB ?? 0}
                </div>
              </div>
            </div>

            {match.setHistory && match.setHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2 justify-center">
                {match.setHistory.map((set, i) => (
                  <span key={i} className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full">
                    S{i+1}: {set.scoreA}-{set.scoreB}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
