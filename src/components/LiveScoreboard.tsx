import React, { useState } from 'react';
import { TournamentMatch, SetScore } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Trophy, Plus, Minus, CheckCircle2, XCircle, History } from 'lucide-react';
import { toast } from 'sonner';

interface LiveScoreboardProps {
  match: TournamentMatch;
  bracketId: string;
  onClose: () => void;
}

export default function LiveScoreboard({ match, bracketId, onClose }: LiveScoreboardProps) {
  const [currentScoreA, setCurrentScoreA] = useState(match.currentSetPoints?.scoreA || 0);
  const [currentScoreB, setCurrentScoreB] = useState(match.currentSetPoints?.scoreB || 0);
  const [setsA, setSetsA] = useState(match.scoreA || 0);
  const [setsB, setSetsB] = useState(match.scoreB || 0);
  const [history, setHistory] = useState<SetScore[]>(match.setHistory || []);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateMatchFirestore = async (updates: Partial<TournamentMatch>, isFinal = false) => {
    setIsUpdating(true);
    try {
      const matchRef = doc(db, `brackets/${bracketId}/matches/${match.id}`);
      await updateDoc(matchRef, {
        currentSetPoints: { scoreA: currentScoreA, scoreB: currentScoreB },
        scoreA: setsA,
        scoreB: setsB,
        setHistory: history,
        status: isFinal ? 'completed' : 'ongoing',
        updatedAt: serverTimestamp(),
        ...updates
      });

      if (isFinal && updates.winnerId && match.nextMatchId) {
        const nextMatchRef = doc(db, `brackets/${bracketId}/matches/${match.nextMatchId}`);
        const nextMatchSnap = await getDoc(nextMatchRef);
        
        if (nextMatchSnap.exists()) {
          const isTeamA = match.matchIndex % 2 === 0;
          const winnerName = updates.winnerId === match.teamAId ? match.teamAName : match.teamBName;
          await updateDoc(nextMatchRef, {
            [isTeamA ? 'teamAId' : 'teamBId']: updates.winnerId,
            [isTeamA ? 'teamAName' : 'teamBName']: winnerName,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      toast.success(isFinal ? 'Match completed!' : 'Score updated!');
      if (isFinal) onClose();
    } catch (error) {
      console.error('Update failed', error);
      toast.error('Failed to update score');
    } finally {
      setIsUpdating(false);
    }
  };

  const addPoint = (team: 'A' | 'B') => {
    if (team === 'A') setCurrentScoreA(prev => prev + 1);
    else setCurrentScoreB(prev => prev + 1);
  };

  const removePoint = (team: 'A' | 'B') => {
    if (team === 'A') setCurrentScoreA(prev => Math.max(0, prev - 1));
    else setCurrentScoreB(prev => Math.max(0, prev - 1));
  };

  const finishSet = () => {
    const newSetsA = currentScoreA > currentScoreB ? setsA + 1 : setsA;
    const newSetsB = currentScoreB > currentScoreA ? setsB + 1 : setsB;
    const newHistory = [...history, { scoreA: currentScoreA, scoreB: currentScoreB }];
    
    setSetsA(newSetsA);
    setSetsB(newSetsB);
    setHistory(newHistory);
    setCurrentScoreA(0);
    setCurrentScoreB(0);
    
    toast.success('Set completed!');
  };

  const finishMatch = (winnerId: string) => {
    updateMatchFirestore({ winnerId }, true);
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="p-0 mb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-black italic uppercase tracking-tighter">
            Match <span className="text-primary">Control</span>
          </CardTitle>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 animate-pulse">
            LIVE
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 space-y-8">
        {/* Sets Score */}
        <div className="flex items-center justify-center gap-12 py-6 bg-muted/30 rounded-3xl border border-border/50">
          <div className="text-center">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{match.teamAName}</p>
            <div className="text-5xl font-black text-foreground">{setsA}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1">SETS</p>
          </div>
          <div className="text-2xl font-black text-muted-foreground opacity-20 italic">VS</div>
          <div className="text-center">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{match.teamBName}</p>
            <div className="text-5xl font-black text-foreground">{setsB}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1">SETS</p>
          </div>
        </div>

        {/* Current Set Counter */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Current Set Score</h4>
            <div className="h-px flex-1 mx-4 bg-border/50" />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Team A Points */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center gap-4">
                <span className="text-4xl font-black">{currentScoreA}</span>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => removePoint('A')} className="w-10 h-10 rounded-xl">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={() => addPoint('A')} className="w-10 h-10 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Team B Points */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center gap-4">
                <span className="text-4xl font-black">{currentScoreB}</span>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => removePoint('B')} className="w-10 h-10 rounded-xl">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={() => addPoint('B')} className="w-10 h-10 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Set History */}
        {history.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <History className="w-3 h-3" />
              Set History
            </div>
            <div className="flex gap-2 flex-wrap">
              {history.map((set, i) => (
                <div key={i} className="px-3 py-1.5 bg-muted/50 border border-border rounded-lg text-[11px] font-bold">
                  S{i+1}: <span className={set.scoreA > set.scoreB ? 'text-primary' : ''}>{set.scoreA}</span> - <span className={set.scoreB > set.scoreA ? 'text-primary' : ''}>{set.scoreB}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3 pt-4">
          <Button 
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest"
            onClick={() => updateMatchFirestore({})}
            disabled={isUpdating}
          >
            Sync Score Only
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5"
            onClick={finishSet}
          >
            Finish Set & Sync
          </Button>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button 
              variant="destructive"
              className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 group"
              onClick={() => match.teamAId && finishMatch(match.teamAId)}
            >
              <Trophy className="w-4 h-4 group-hover:scale-125 transition-transform" />
              <div className="text-[9px] font-black uppercase">{match.teamAName} Wins</div>
            </Button>
            <Button 
              variant="destructive"
              className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 group"
              onClick={() => match.teamBId && finishMatch(match.teamBId)}
            >
              <Trophy className="w-4 h-4 group-hover:scale-125 transition-transform" />
              <div className="text-[9px] font-black uppercase">{match.teamBName} Wins</div>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
