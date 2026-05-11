import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { TournamentMatch, TournamentBracket } from '../types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trophy, ChevronRight, Users, Loader2, Save, Play, Activity, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import LiveScoreboard from './LiveScoreboard';

interface BracketBuilderProps {
  tournamentId: string;
  isOrganizer: boolean;
  teams: { userId: string; userName: string; teamName?: string }[];
}

export default function BracketBuilder({ tournamentId, isOrganizer, teams }: BracketBuilderProps) {
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeLiveMatch, setActiveLiveMatch] = useState<TournamentMatch | null>(null);
  const [isEditingFixtures, setIsEditingFixtures] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ matchId: string; slot: 'A' | 'B' } | null>(null);

  useEffect(() => {
    const bracketQuery = query(collection(db, 'brackets'), where('tournamentId', '==', tournamentId));
    const unsubscribeBracket = onSnapshot(bracketQuery, (snapshot) => {
      if (!snapshot.empty) {
        const bracketDoc = snapshot.docs[0];
        const bracketData = { id: bracketDoc.id, ...bracketDoc.data() } as TournamentBracket;
        setBracket(bracketData);
        
        const matchesQuery = collection(db, `brackets/${bracketDoc.id}/matches`);
        const unsubscribeMatches = onSnapshot(matchesQuery, (mSnapshot) => {
          const mData = mSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentMatch));
          setMatches(mData);
          setLoading(false);
        });
        return () => unsubscribeMatches();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeBracket();
  }, [tournamentId]);

  const generateSingleElimination = async () => {
    if (teams.length < 2) {
      toast.error('At least 2 teams are required to generate a bracket.');
      return;
    }

    setIsGenerating(true);
    try {
      const numTeams = teams.length;
      const numRounds = Math.ceil(Math.log2(numTeams));
      const totalCapacity = Math.pow(2, numRounds);
      
      const bracketRef = doc(collection(db, 'brackets'));
      await setDoc(bracketRef, {
        tournamentId,
        type: 'single',
        totalTeams: numTeams,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Close registration for the tournament
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        registrationClosed: true,
        updatedAt: serverTimestamp()
      });

      for (let r = 0; r < numRounds; r++) {
        const matchesInRound = Math.pow(2, numRounds - r - 1);
        for (let m = 0; m < matchesInRound; m++) {
          const matchId = `match_${r}_${m}`;
          const nextMatchId = r < numRounds - 1 ? `match_${r + 1}_${Math.floor(m / 2)}` : null;
          
          const matchData: any = {
            id: matchId,
            bracketId: bracketRef.id,
            roundIndex: r,
            matchIndex: m,
            status: 'pending',
            nextMatchId: nextMatchId,
            scoreA: 0,
            scoreB: 0,
            setHistory: [],
            currentSetPoints: { scoreA: 0, scoreB: 0 }
          };

          if (r === 0) {
            const teamAIdx = m * 2;
            const teamBIdx = m * 2 + 1;
            
            if (teamAIdx < teams.length) {
              matchData.teamAId = teams[teamAIdx].userId;
              matchData.teamAName = teams[teamAIdx].teamName || teams[teamAIdx].userName;
            }
            if (teamBIdx < teams.length) {
              matchData.teamBId = teams[teamBIdx].userId;
              matchData.teamBName = teams[teamBIdx].teamName || teams[teamBIdx].userName;
            } else if (teamAIdx < teams.length) {
              matchData.status = 'completed';
              matchData.winnerId = matchData.teamAId;
              matchData.scoreA = 1;
              matchData.scoreB = 0;
            }
          }

          await setDoc(doc(db, `brackets/${bracketRef.id}/matches/${matchId}`), matchData);
        }
      }

      toast.success('Bracket generated successfully!');
    } catch (error) {
      console.error('Bracket generation failed', error);
      toast.error('Failed to generate bracket.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateEmptyBracket = async (type: 'single' | 'round-robin') => {
    if (teams.length < 2) {
      toast.error('At least 2 teams are required.');
      return;
    }

    setIsGenerating(true);
    try {
      const bracketRef = doc(collection(db, 'brackets'));
      await setDoc(bracketRef, {
        tournamentId,
        type,
        totalTeams: teams.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Close registration for the tournament
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        registrationClosed: true,
        updatedAt: serverTimestamp()
      });

      if (type === 'single') {
        const numTeams = teams.length;
        const numRounds = Math.ceil(Math.log2(numTeams));
        for (let r = 0; r < numRounds; r++) {
          const matchesInRound = Math.pow(2, numRounds - r - 1);
          for (let m = 0; m < matchesInRound; m++) {
            const matchId = `match_${r}_${m}`;
            const nextMatchId = r < numRounds - 1 ? `match_${r + 1}_${Math.floor(m / 2)}` : null;
            
            await setDoc(doc(db, `brackets/${bracketRef.id}/matches/${matchId}`), {
              id: matchId,
              bracketId: bracketRef.id,
              roundIndex: r,
              matchIndex: m,
              status: 'pending',
              nextMatchId: nextMatchId,
              scoreA: 0,
              scoreB: 0,
              setHistory: [],
              currentSetPoints: { scoreA: 0, scoreB: 0 }
            });
          }
        }
      } else {
        // Round robin needs pairs, creating empty slots might not make sense for RR
        // as the matches are defined by pairings. 
        // But we can generate RR normally and let them swap.
        await generateRoundRobin(bracketRef.id);
      }

      toast.success('Empty fixtures created. You can now manually assign teams.');
      setIsEditingFixtures(true);
    } catch (error) {
      toast.error('Failed to create fixtures');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateRoundRobin = async (existingBracketId?: string) => {
    if (teams.length < 2) {
      toast.error('At least 2 teams are required.');
      return;
    }

    setIsGenerating(true);
    try {
      let bracketRef;
      if (existingBracketId) {
        bracketRef = doc(db, 'brackets', existingBracketId);
      } else {
        bracketRef = doc(collection(db, 'brackets'));
        await setDoc(bracketRef, {
          tournamentId,
          type: 'round-robin',
          totalTeams: teams.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Close registration for the tournament
        await updateDoc(doc(db, 'tournaments', tournamentId), {
          registrationClosed: true,
          updatedAt: serverTimestamp()
        });
      }

      let matchIdx = 0;
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const matchId = `match_rr_${matchIdx}`;
          await setDoc(doc(db, `brackets/${bracketRef.id}/matches/${matchId}`), {
            id: matchId,
            bracketId: bracketRef.id,
            roundIndex: 0,
            matchIndex: matchIdx,
            teamAId: teams[i].userId,
            teamAName: teams[i].teamName || teams[i].userName,
            teamBId: teams[j].userId,
            teamBName: teams[j].teamName || teams[j].userName,
            scoreA: 0,
            scoreB: 0,
            status: 'pending',
            setHistory: [],
            currentSetPoints: { scoreA: 0, scoreB: 0 }
          });
          matchIdx++;
        }
      }

      if (!existingBracketId) toast.success('Round Robin league generated!');
    } catch (error) {
      console.error('RR generation failed', error);
      toast.error('Failed to generate league.');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteBracket = async () => {
    if (!bracket) return;
    if (!confirm('Are you sure you want to delete the whole bracket? This will erase all results.')) return;

    try {
      const { deleteDoc, getDocs, collection } = await import('firebase/firestore');
      const matchesSnap = await getDocs(collection(db, `brackets/${bracket.id}/matches`));
      for (const mDoc of matchesSnap.docs) {
        await deleteDoc(mDoc.ref);
      }
      await deleteDoc(doc(db, 'brackets', bracket.id));
      setBracket(null);
      setMatches([]);
      toast.success('Bracket deleted');
    } catch (error) {
      toast.error('Failed to delete bracket');
    }
  };

  const updateMatchFixture = async (matchId: string, teamAId?: string, teamAName?: string, teamBId?: string, teamBName?: string) => {
    if (!bracket) return;
    try {
      const updateData: any = {};
      if (teamAId !== undefined) {
        updateData.teamAId = teamAId;
        updateData.teamAName = teamAName;
      }
      if (teamBId !== undefined) {
        updateData.teamBId = teamBId;
        updateData.teamBName = teamBName;
      }
      await updateDoc(doc(db, `brackets/${bracket.id}/matches`, matchId), updateData);
      toast.success('Fixture updated');
    } catch (error) {
      toast.error('Failed to update fixture');
    }
  };

  const startMatch = async (match: TournamentMatch) => {
    try {
      await updateDoc(doc(db, `brackets/${bracket!.id}/matches/${match.id}`), {
        status: 'ongoing',
        startTime: serverTimestamp()
      });
      toast.success('Match started! Switching to Live mode.');
      setActiveLiveMatch(match);
    } catch (error) {
      toast.error('Failed to start match');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bracket && isOrganizer) {
    return (
      <div className="text-center py-12 bg-muted/20 rounded-2xl border-2 border-dashed border-border p-8">
        <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2 text-slate-800">Generate Tournament Bracket</h3>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">
          Once all teams have registered, you can generate an automated bracket or setup fixtures manually.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold py-1 px-3">
            {teams.length} Teams Registered
          </Badge>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button 
              onClick={generateSingleElimination} 
              disabled={isGenerating || teams.length < 2}
              className="bg-primary hover:bg-primary/90 text-white font-black h-12 rounded-xl"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
              Auto Single Elimination
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => generateEmptyBracket('single')} 
                disabled={isGenerating || teams.length < 2}
                variant="outline"
                className="border-primary text-primary font-black h-12 rounded-xl text-xs"
              >
                Manual Single Elim
              </Button>
              <Button 
                onClick={generateRoundRobin} 
                disabled={isGenerating || teams.length < 2}
                variant="outline"
                className="border-primary text-primary font-black h-12 rounded-xl text-xs"
              >
                League (RR)
              </Button>
            </div>
          </div>
          {teams.length < 2 && (
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-2">
              Requires at least 2 teams to start
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div className="text-center py-20 opacity-50">
        <Trophy className="w-12 h-12 mx-auto mb-4" />
        <p className="font-bold">Tournament bracket not generated yet.</p>
      </div>
    );
  }

  const numRounds = bracket.type === 'single' ? Math.ceil(Math.log2(bracket.totalTeams)) : 1;
  const rounds = Array.from({ length: numRounds }, (_, i) => {
    return matches.filter(m => m.roundIndex === i).sort((a, b) => a.matchIndex - b.matchIndex);
  });

  return (
    <div className="space-y-6">
      {isOrganizer && (
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Badge variant={isEditingFixtures ? "default" : "outline"} className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
              {isEditingFixtures ? 'Editing Mode' : 'View Mode'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isEditingFixtures ? "default" : "outline"}
              className="h-8 text-[10px] font-black uppercase tracking-widest rounded-lg"
              onClick={() => setIsEditingFixtures(!isEditingFixtures)}
            >
              <Edit3 className="w-3 h-3 mr-2" />
              {isEditingFixtures ? 'Finish Editing' : 'Customize Fixers'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={deleteBracket}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Reset Bracket
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-8 custom-scrollbar">
        <div className="flex gap-16 min-w-max p-4 items-center">
          {rounds.map((roundMatches, rIdx) => (
            <div key={rIdx} className="space-y-12">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">
                {bracket.type === 'round-robin' ? 'League Matches' : 
                 rIdx === rounds.length - 1 ? 'Finals' : 
                 rIdx === rounds.length - 2 ? 'Semi-finals' : `Round ${rIdx + 1}`}
              </h4>
              <div className="flex flex-col justify-around h-full gap-8">
                {roundMatches.map((match, mIdx) => (
                  <div key={match.id} className="relative">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: rIdx * 0.1 + mIdx * 0.05 }}
                      className={cn(
                        "w-56 bg-card border rounded-2xl shadow-sm overflow-hidden transition-all duration-300",
                        match.status === 'ongoing' ? "ring-2 ring-primary border-transparent" : 
                        isEditingFixtures ? "ring-1 ring-primary/30 border-primary/20" : "border-border/50"
                      )}
                    >
                      <div className="p-4 space-y-3">
                        {/* Match Header */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest shrink-0">
                            Match #{mIdx + 1}
                          </span>
                          {match.status === 'ongoing' ? (
                            <div className="flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                              <span className="text-[9px] font-black text-primary uppercase tracking-tighter">LIVE</span>
                            </div>
                          ) : isEditingFixtures && (
                            <Badge variant="outline" className="text-[7px] font-black border-primary/20 text-primary py-0 px-1">EDITABLE</Badge>
                          )}
                        </div>

                        {/* Teams */}
                        <div className="space-y-2">
                          <button 
                            disabled={!isEditingFixtures || match.status !== 'pending'}
                            onClick={() => setSelectedSlot({ matchId: match.id, slot: 'A' })}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-black transition-all text-left",
                              match.winnerId === match.teamAId && match.teamAId ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted/30 text-foreground/70",
                              !match.teamAId && "opacity-30 italic font-normal",
                              isEditingFixtures && match.status === 'pending' && "hover:bg-primary/10 hover:border-primary/30 ring-1 ring-transparent hover:ring-primary/20"
                            )}>
                            <span className="truncate max-w-[120px]">{match.teamAName || 'TBD'}</span>
                            <span className="text-sm">{match.scoreA ?? 0}</span>
                          </button>

                          <button 
                            disabled={!isEditingFixtures || match.status !== 'pending'}
                            onClick={() => setSelectedSlot({ matchId: match.id, slot: 'B' })}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-black transition-all text-left",
                              match.winnerId === match.teamBId && match.teamBId ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted/30 text-foreground/70",
                              !match.teamBId && "opacity-30 italic font-normal",
                              isEditingFixtures && match.status === 'pending' && "hover:bg-primary/10 hover:border-primary/30 ring-1 ring-transparent hover:ring-primary/20"
                            )}>
                            <span className="truncate max-w-[120px]">{match.teamBName || 'TBD'}</span>
                            <span className="text-sm">{match.scoreB ?? 0}</span>
                          </button>
                        </div>

                        {/* Current Point Status if Ongoing */}
                        {match.status === 'ongoing' && match.currentSetPoints && (
                          <div className="flex items-center justify-center gap-3 py-1 bg-primary/5 rounded-lg border border-primary/10">
                            <span className="text-[14px] font-black text-primary">{match.currentSetPoints.scoreA}</span>
                            <span className="text-[10px] font-black text-primary/30">:</span>
                            <span className="text-[14px] font-black text-primary">{match.currentSetPoints.scoreB}</span>
                          </div>
                        )}

                        {/* Organizer Controls */}
                        {isOrganizer && !isEditingFixtures && match.teamAId && match.teamBId && match.status !== 'completed' && (
                          <div className="pt-2 border-t border-border/50">
                            {match.status === 'pending' ? (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="w-full h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                                onClick={() => startMatch(match)}
                              >
                                <Play className="w-3 h-3 mr-2 fill-primary" /> Start Match
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                className="w-full h-8 text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90"
                                onClick={() => setActiveLiveMatch(match)}
                              >
                                <Activity className="w-3 h-3 mr-2" /> Live Scoring
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                    
                    {/* Visual Connectors (Right Side for Single Elim) */}
                    {bracket.type === 'single' && rIdx < rounds.length - 1 && (
                      <div className="absolute top-1/2 -right-16 w-16 h-px bg-border/50">
                         <div className={cn(
                           "absolute right-0 top-0 w-px h-24 bg-border/50",
                           mIdx % 2 === 0 ? "top-0 h-[50%]" : "bottom-0 h-[50%] -translate-y-full"
                         )} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Selection Dialog for Manual Assignment */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic">Assign Team</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground">Select a team for Match #{matches.find(m => m.id === selectedSlot?.matchId)?.matchIndex! + 1}</p>
            <Select onValueChange={(val) => {
              if (!selectedSlot) return;
              const team = teams.find(t => t.userId === val);
              if (team) {
                const teamName = team.teamName || team.userName;
                if (selectedSlot.slot === 'A') {
                  updateMatchFixture(selectedSlot.matchId, team.userId, teamName, undefined, undefined);
                } else {
                  updateMatchFixture(selectedSlot.matchId, undefined, undefined, team.userId, teamName);
                }
                setSelectedSlot(null);
              }
            }}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder="Choose a registered team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">-- Clear Slot (TBD) --</SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.userId} value={t.userId}>{t.teamName || t.userName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Special handling for Clear */}
            <Button 
              variant="outline" 
              className="w-full text-xs font-bold"
              onClick={() => {
                if (!selectedSlot) return;
                if (selectedSlot.slot === 'A') {
                  updateMatchFixture(selectedSlot.matchId, "", "TBD", undefined, undefined);
                } else {
                  updateMatchFixture(selectedSlot.matchId, undefined, undefined, "", "TBD");
                }
                setSelectedSlot(null);
              }}
            >
              Clear This Slot
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeLiveMatch} onOpenChange={(open) => !open && setActiveLiveMatch(null)}>
        <DialogContent className="sm:max-w-[450px]">
          {activeLiveMatch && (
            <LiveScoreboard 
              match={activeLiveMatch}
              bracketId={bracket.id}
              onClose={() => setActiveLiveMatch(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
