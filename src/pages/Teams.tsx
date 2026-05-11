import React, { useEffect, useState, useRef } from 'react';
import { db, OperationType, handleFirestoreError, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { Users, Trophy, Shield, Plus, Send, CheckCircle2, XCircle, Calendar, MapPin, History, Crown, LogOut, Trash2, Camera, Loader2, Hash, Copy } from 'lucide-react';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import { Team, TeamChallenge, UserProfile, Court } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../lib/utils';

export default function Teams() {
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [challenges, setChallenges] = useState<TeamChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isChallenging, setIsChallenging] = useState<Team | null>(null);
  const [isManagingTeam, setIsManagingTeam] = useState<Team | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [editingTeamDescription, setEditingTeamDescription] = useState('');
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newTeamLogo, setNewTeamLogo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    type: 'leave' | 'transfer' | 'delete' | null;
    id: string | null;
    meta?: any;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: '',
    description: ''
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000); // Update time every 10 seconds for countdowns
    return () => clearInterval(timer);
  }, []);

  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isJoinCodeDialogOpen, setIsJoinCodeDialogOpen] = useState(false);
  const [isJoiningProgress, setIsJoiningProgress] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    date: '',
    location: '',
    courtId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('name', 'asc'));
    const unsubscribeTeams = onSnapshot(q, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      setLoading(false);
    });

    const qChallenges = query(collection(db, 'teamChallenges'), orderBy('createdAt', 'desc'));
    const unsubscribeChallenges = onSnapshot(qChallenges, (snapshot) => {
      setChallenges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChallenge)));
    });

    const qCourts = query(collection(db, 'courts'), orderBy('name', 'asc'));
    const unsubscribeCourts = onSnapshot(qCourts, (snapshot) => {
      setCourts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court)));
    });

    return () => {
      unsubscribeTeams();
      unsubscribeChallenges();
      unsubscribeCourts();
    };
  }, []);

  useEffect(() => {
    if (isManagingTeam) {
      const fetchMembers = async () => {
        setIsFetchingMembers(true);
        setEditingTeamName(isManagingTeam.name);
        setEditingTeamDescription(isManagingTeam.description || '');
        try {
          const q = query(collection(db, 'users'), where('uid', 'in', isManagingTeam.members));
          const snapshot = await getDocs(q);
          setTeamMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
        } catch (error) {
          console.error("Error fetching members:", error);
          toast.error("Failed to load team members");
        } finally {
          setIsFetchingMembers(false);
        }
      };
      fetchMembers();
    } else {
      setTeamMembers([]);
    }
  }, [isManagingTeam]);

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return;

    const ownedTeam = teams.find(t => t.captain === user.uid && !t.archived);
    if (ownedTeam) {
      toast.error('You can only lead one team at a time.');
      return;
    }

    const memberTeams = teams.filter(t => t.members.includes(user.uid) && !t.archived);
    if (memberTeams.length >= 5) {
      toast.error('You have reached the maximum limit of 5 teams.');
      return;
    }

    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'teams'), {
        name: newTeamName.trim(),
        description: newTeamDescription.trim(),
        captain: user.uid,
        members: [user.uid],
        logoURL: newTeamLogo || '',
        teamCode: generateCode(),
        readyPlayers: [],
        stats: { matchesPlayed: 0, wins: 0 },
        createdAt: serverTimestamp()
      });
      toast.success('Team created successfully!');
      setIsCreatingTeam(false);
      setNewTeamName('');
      setNewTeamDescription('');
      setNewTeamLogo('');
    } catch (error) {
      console.error('Team creation failed:', error);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'teams');
      } catch (e) {
        // handleFirestoreError throws, we already catch it and toast
      }
      toast.error('Failed to create team. Ensure logo is small (< 500KB).');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, teamId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error('Maximum upload size is 500KB');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        if (teamId) {
          await updateDoc(doc(db, 'teams', teamId), {
            logoURL: base64String
          });
          toast.success('Team logo updated!');
          if (isManagingTeam?.id === teamId) {
            setIsManagingTeam({ ...isManagingTeam, logoURL: base64String });
          }
        } else {
          setNewTeamLogo(base64String);
          toast.success('Logo ready');
        }
        setIsUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Logo upload failed:', error);
      handleFirestoreError(error, OperationType.UPDATE, teamId || 'teams');
      toast.error('Failed to process logo');
      setIsUploadingLogo(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!user || !joinCode.trim()) return;
    
    setIsJoiningProgress(true);
    try {
      const q = query(collection(db, 'teams'), where('teamCode', '==', joinCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('Invalid team code. Please check and try again.');
        setIsJoiningProgress(false);
        return;
      }
      
      const teamDoc = querySnapshot.docs[0];
      const teamData = teamDoc.data() as Team;
      const teamId = teamDoc.id;
      
      // Validation checks
      if (teamData.members.includes(user.uid)) {
        toast.error('You are already a member of this team.');
        setIsJoiningProgress(false);
        return;
      }
      
      const ownedTeam = teams.find(t => t.captain === user.uid && !t.archived);
      const joinedTeams = teams.filter(t => t.members.includes(user.uid) && t.captain !== user.uid && !t.archived);
      
      if (joinedTeams.length >= 4) {
        toast.error('You can join up to 4 teams in addition to your own.');
        setIsJoiningProgress(false);
        return;
      }
      
      const totalTeams = teams.filter(t => t.members.includes(user.uid) && !t.archived);
      if (totalTeams.length >= 5) {
        toast.error('You have reached the maximum limit of 5 teams total.');
        setIsJoiningProgress(false);
        return;
      }
      
      await updateDoc(doc(db, 'teams', teamId), {
        members: [...teamData.members, user.uid]
      });
      
      toast.success(`Succesfully joined ${teamData.name}!`);
      setJoinCode('');
      setIsJoinCodeDialogOpen(false);
    } catch (error) {
      console.error('Join by code failed:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'join-by-code');
      toast.error('Failed to join team.');
    } finally {
      setIsJoiningProgress(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!user) {
      toast.error('Please sign in to join a team');
      return;
    }
    
    // Check if user is already in this team
    const inThisTeam = teams.find(t => t.id === teamId && t.members.includes(user.uid));
    if (inThisTeam) {
      toast.error('You are already a member of this team.');
      return;
    }

    // Check if user has reached the join limit (4 teams except their own)
    const ownedTeam = teams.find(t => t.captain === user.uid && !t.archived);
    const joinedTeams = teams.filter(t => t.members.includes(user.uid) && t.captain !== user.uid && !t.archived);
    
    if (joinedTeams.length >= 4) {
      toast.error('You can join up to 4 teams in addition to your own.');
      return;
    }

    // Absolute cap of 5 teams
    const totalTeams = teams.filter(t => t.members.includes(user.uid) && !t.archived);
    if (totalTeams.length >= 5) {
      toast.error('You have reached the maximum limit of 5 teams total.');
      return;
    }

    try {
      const teamRef = doc(db, 'teams', teamId);
      const team = teams.find(t => t.id === teamId);
      if (team) {
        await updateDoc(teamRef, {
          members: [...team.members, user.uid]
        });
        toast.success(`Joined ${team.name}!`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${teamId}`);
      toast.error('Failed to join team');
    }
  };

  const handleLeaveTeamRequest = async (teamId: string) => {
    if (!user) return;
    const team = teams.find(t => t.id === teamId);
    const isCaptain = team?.captain === user.uid;
    
    setConfirmConfig({
      isOpen: true,
      type: 'leave',
      id: teamId,
      title: isCaptain ? 'Leave & Abandon Team' : 'Leave Team',
      description: isCaptain 
        ? 'As captain, if you leave without transferring leadership, the team will be automatically deleted in 10 minutes unless another member claims it.'
        : 'Are you sure you want to leave this team? You will need to be re-added by the captain to join again.'
    });
  };
  const handleLeaveTeam = async (teamId: string) => {
    if (!user) return;
    try {
      const teamRef = doc(db, 'teams', teamId);
      const team = teams.find(t => t.id === teamId);
      if (team) {
        if (team.captain === user?.uid) {
          // If captain is leaving and they are the LAST member, just archive it
          if (team.members.length === 1) {
            await updateDoc(teamRef, { 
              members: [], 
              captain: '',
              archived: true 
            });
            toast.success('Team archived as you were the last member.');
          } else {
            // Captain is leaving but others remain. Schedule deletion in 10 minutes.
            const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
            await updateDoc(teamRef, {
              captain: '',
              members: team.members.filter(m => m !== user.uid),
              readyPlayers: (team.readyPlayers || []).filter(m => m !== user.uid),
              deleteAt: tenMinutesFromNow
            });
            toast.warning('Team abandoned! It will be deleted in 10 minutes unless someone claims leadership.');
          }
          return;
        }
        await updateDoc(teamRef, {
          members: team.members.filter(m => m !== user.uid),
          readyPlayers: (team.readyPlayers || []).filter(m => m !== user.uid)
        });
        toast.success(`Left ${team.name}`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${teamId}`);
      toast.error('Failed to leave team');
    }
  };

  const handleClaimCaptaincy = async (teamId: string) => {
    if (!user) return;
    try {
      const teamRef = doc(db, 'teams', teamId);
      const team = teams.find(t => t.id === teamId);
      if (team && !team.captain) {
        await updateDoc(teamRef, {
          captain: user.uid,
          deleteAt: null // Cancel deletion
        });
        toast.success(`You are now the captain of ${team.name}! Deletion cancelled.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${teamId}`);
      toast.error('Failed to claim leadership');
    }
  };

  const handleSendChallenge = async () => {
    if (!user || !isChallenging) return;
    
    // Find my team (where I am captain)
    const myTeam = teams.find(t => t.captain === user.uid);
    if (!myTeam) {
      toast.error('You must be a team captain to send challenges');
      return;
    }

    try {
      await addDoc(collection(db, 'teamChallenges'), {
        fromTeamId: myTeam.id,
        toTeamId: isChallenging.id,
        fromTeamName: myTeam.name,
        toTeamName: isChallenging.name,
        scheduledDate: challengeForm.date,
        location: challengeForm.location,
        courtId: challengeForm.courtId || null,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Notify the target team's captain
      if (isChallenging.captain) {
        await addDoc(collection(db, 'notifications'), {
          userId: isChallenging.captain,
          title: 'New Team Challenge!',
          message: `${myTeam.name} has challenged your team to a match!`,
          type: 'match',
          link: '/teams',
          createdAt: serverTimestamp()
        });
      }

      toast.success('Challenge sent!');
      setIsChallenging(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'teamChallenges');
      toast.error('Failed to send challenge');
    }
  };

  const handleChallengeStatus = async (challengeId: string, status: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'teamChallenges', challengeId), { status });
      
      // Notify the challenger
      const challenge = challenges.find(c => c.id === challengeId);
      if (challenge) {
        const challengerTeam = teams.find(t => t.id === challenge.fromTeamId);
        if (challengerTeam?.captain) {
          await addDoc(collection(db, 'notifications'), {
            userId: challengerTeam.captain,
            title: `Challenge ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
            message: `${challenge.toTeamName} has ${status} your challenge!`,
            type: status === 'accepted' ? 'success' : 'info',
            link: '/teams',
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success(`Challenge ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teamChallenges/${challengeId}`);
      toast.error('Failed to update challenge');
    }
  };

  const handleTransferCaptaincyRequest = async (teamId: string, newCaptainId: string) => {
    if (!user) return;
    setConfirmConfig({
      isOpen: true,
      type: 'transfer',
      id: teamId,
      meta: newCaptainId,
      title: 'Transfer Captaincy',
      description: 'Are you sure you want to transfer captaincy? You will no longer be the captain of this team.'
    });
  };

  const handleTransferCaptaincy = async (teamId: string, newCaptainId: string) => {
    try {
      await updateDoc(doc(db, 'teams', teamId), {
        captain: newCaptainId
      });
      toast.success('Captaincy transferred successfully!');
      setIsManagingTeam(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${teamId}`);
      toast.error('Failed to transfer captaincy');
    }
  };

  const handleDeleteTeamRequest = async (teamId: string) => {
    if (!user) return;
    setConfirmConfig({
      isOpen: true,
      type: 'delete',
      id: teamId,
      title: 'Archive Team',
      description: 'Are you sure? This will permanently archive the team and remove its squad.'
    });
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await updateDoc(doc(db, 'teams', teamId), { 
        status: 'deleted', // Soft delete or handle as needed. Actual delete would be deleteDoc.
        members: [] 
      });
      // For this app, let's just delete the doc to avoid cluttering 'deleted' teams
      // await deleteDoc(doc(db, 'teams', teamId)); 
      // But updateDoc with members empty is safer as a first step in many apps.
      // Let's use a simple delete if security rules allow.
      // For simplicity here, I'll just remove the members and set a flag.
      await updateDoc(doc(db, 'teams', teamId), { archived: true });
      toast.success('Team archived');
      setIsManagingTeam(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${teamId}`);
      toast.error('Failed to delete team');
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    if (isRemovingMember) return;
    setIsRemovingMember(true);
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const newMembers = team.members.filter(m => m !== memberId);
      const newReadyPlayers = (team.readyPlayers || []).filter(m => m !== memberId);

      await updateDoc(doc(db, 'teams', teamId), {
        members: newMembers,
        readyPlayers: newReadyPlayers
      });

      toast.success('Member removed from squad');
      // Refresh local team members list
      setTeamMembers(prev => prev.filter(m => m.uid !== memberId));
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error('Failed to remove member');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleAddMemberByEmail = async () => {
    if (!isManagingTeam || !memberEmail.trim()) return;
    
    setIsAddingMember(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', memberEmail.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('No player found with this email.');
        return;
      }
      
      const targetUser = querySnapshot.docs[0].data() as UserProfile;
      const targetUserId = querySnapshot.docs[0].id;
      
      if (isManagingTeam.members.includes(targetUserId)) {
        toast.error('This player is already in your squad.');
        return;
      }

      // Check limits for target user
      const targetUserTeams = teams.filter(t => t.members.includes(targetUserId) && !t.archived);
      if (targetUserTeams.length >= 5) {
        toast.error('This player has reached their maximum team limit.');
        return;
      }
      
      await updateDoc(doc(db, 'teams', isManagingTeam.id), {
        members: [...isManagingTeam.members, targetUserId]
      });
      
      toast.success(`${targetUser.displayName} added to squad!`);
      setMemberEmail('');
      // Refresh members list locally
      setTeamMembers(prev => [...prev, targetUser]);
      // Update isManagingTeam locally to keep consistency if needed
      setIsManagingTeam({
        ...isManagingTeam,
        members: [...isManagingTeam.members, targetUserId]
      });
    } catch (error) {
      console.error('Add member failed:', error);
      handleFirestoreError(error, OperationType.UPDATE, `teams/${isManagingTeam.id}`);
      toast.error('Failed to add member.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const ensureTeamCode = async () => {
    if (!isManagingTeam || isManagingTeam.teamCode) return;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    try {
      await updateDoc(doc(db, 'teams', isManagingTeam.id), {
        teamCode: code
      });
      setIsManagingTeam({...isManagingTeam, teamCode: code});
      toast.success('Team code generated!');
    } catch (error) {
      toast.error('Failed to generate code');
    }
  };

  const handleToggleReadyStatus = async (teamId: string) => {
    if (!user) return;
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const readyPlayers = team.readyPlayers || [];
      const isReady = readyPlayers.includes(user.uid);
      
      const newReadyPlayers = isReady 
        ? readyPlayers.filter(id => id !== user.uid)
        : [...readyPlayers, user.uid];

      await updateDoc(doc(db, 'teams', teamId), {
        readyPlayers: newReadyPlayers
      });

      toast.success(isReady ? 'Availability updated: Not Ready' : 'Marked as Ready for Tournament!');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateTeamDetails = async () => {
    if (!isManagingTeam || !editingTeamName.trim()) return;
    const nameChanged = editingTeamName.trim() !== isManagingTeam.name;
    const descChanged = editingTeamDescription.trim() !== (isManagingTeam.description || '');
    
    if (!nameChanged && !descChanged) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'teams', isManagingTeam.id), {
        name: editingTeamName.trim(),
        description: editingTeamDescription.trim()
      });
      setIsManagingTeam({ 
        ...isManagingTeam, 
        name: editingTeamName.trim(),
        description: editingTeamDescription.trim()
      });
      toast.success('Team details updated!');
    } catch (error) {
      console.error('Failed to update team details:', error);
      toast.error('Failed to update team details');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myTeam = teams.find(t => t.captain === user?.uid || t.members.includes(user?.uid || ''));
  const activeTeams = teams.filter(t => {
    if (t.archived) return false;
    if (t.deleteAt) {
      const deleteTime = t.deleteAt?.toDate?.()?.getTime() || (typeof t.deleteAt === 'number' ? t.deleteAt : 0);
      if (deleteTime && now > deleteTime) return false;
    }
    return true;
  });
  const receivedChallenges = challenges.filter(c => c.toTeamId === myTeam?.id && c.status === 'pending');
  const sentChallenges = challenges.filter(c => c.fromTeamId === myTeam?.id && c.status === 'pending');
  const activeMatches = challenges.filter(c => (c.fromTeamId === myTeam?.id || c.toTeamId === myTeam?.id) && c.status === 'accepted');

  const handleConfirmAction = () => {
    if (!confirmConfig.id || !confirmConfig.type) return;

    switch (confirmConfig.type) {
      case 'leave':
        handleLeaveTeam(confirmConfig.id);
        break;
      case 'transfer':
        handleTransferCaptaincy(confirmConfig.id, confirmConfig.meta);
        break;
      case 'delete':
        handleDeleteTeam(confirmConfig.id);
        break;
    }

    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 min-h-[calc(100vh-8rem)]">
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        description={confirmConfig.description}
        variant={confirmConfig.type === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div className="space-y-1 text-center lg:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground uppercase italic px-1">
            Teams & Challenges
          </h1>
          <p className="text-muted-foreground text-sm md:text-base px-1">
            Form a team and challenge others to competitive matches.
          </p>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-3 px-2">
          <Dialog open={isJoinCodeDialogOpen} onOpenChange={setIsJoinCodeDialogOpen}>
            <DialogTrigger 
              className={cn(buttonVariants({ variant: "outline" }), "h-11 sm:h-12 w-full sm:w-auto px-6 rounded-xl border-border hover:bg-muted font-bold uppercase tracking-widest text-[10px] shadow-sm shadow-black/5 inline-flex items-center justify-center")}
            >
              <Hash className="w-4 h-4 mr-2 text-primary" />
              Join with Code
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
              <div className="p-8">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">Join Squad</DialogTitle>
                  <p className="text-muted-foreground text-sm font-medium">Enter the unique 6-digit code provided by the captain.</p>
                </DialogHeader>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="joinCode" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Team Access Code</Label>
                    <div className="relative">
                      <Input 
                        id="joinCode" 
                        placeholder="E.G. AB12CD"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="h-16 text-2xl font-black text-center tracking-[0.4em] uppercase rounded-2xl border-2 focus-visible:ring-primary focus-visible:border-primary transition-all bg-muted/30"
                        maxLength={6}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleJoinByCode}
                    disabled={isJoiningProgress || joinCode.length < 6}
                    className="w-full h-14 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {isJoiningProgress ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Verify & Join Team'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreatingTeam} onOpenChange={setIsCreatingTeam}>
            <DialogTrigger 
              disabled={teams.some(t => t.captain === user?.uid && !t.archived) || teams.filter(t => t.members.includes(user?.uid || '') && !t.archived).length >= 5}
              className={cn(
                buttonVariants({ variant: "default" }), 
                "bg-primary hover:bg-primary/90 text-white font-bold h-11 sm:h-12 w-full sm:w-auto px-8 rounded-xl shadow-lg shadow-primary/10 active:scale-95 transition-transform uppercase tracking-widest text-[10px]",
                (teams.some(t => t.captain === user?.uid && !t.archived) || teams.filter(t => t.members.includes(user?.uid || '') && !t.archived).length >= 5) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Plus className="w-4 h-4 mr-2" />
              {teams.some(t => t.captain === user?.uid && !t.archived) ? 'Already a Captain' : 'Create Team'}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                    <Avatar className="w-24 h-24 rounded-2xl border-4 border-muted shadow-xl overflow-hidden group-hover:border-primary/30 transition-colors">
                      <AvatarImage src={newTeamLogo || undefined} className="object-cover" />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        <Shield className="w-10 h-10" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    {isUploadingLogo && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Team Logo</p>
                  <p className="text-[10px] text-muted-foreground font-bold">(Max size: 500KB)</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="teamName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Name</Label>
                  <Input 
                    id="teamName" 
                    value={newTeamName} 
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g., Chennai Smashers"
                    className="h-12 rounded-xl"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="teamDescription" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Motto / Description</Label>
                  <textarea 
                    id="teamDescription"
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Describe your team's playstyle or mission..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateTeam} 
                  className="w-full bg-primary text-white font-bold"
                  disabled={isSubmitting || !newTeamName.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all-teams" className="w-full">
        <div className="bg-muted p-1 rounded-xl mb-8 overflow-x-auto scrollbar-hide">
          <TabsList className="bg-transparent shadow-none w-full justify-start sm:justify-center h-auto flex gap-1 sm:gap-2">
            <TabsTrigger value="all-teams" className="flex-1 sm:flex-initial rounded-lg px-4 sm:px-8 py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs">
              All Teams
            </TabsTrigger>
            <TabsTrigger value="my-challenges" className="flex-1 sm:flex-initial rounded-lg px-4 sm:px-8 py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs relative">
              Challenges
              {(receivedChallenges.length > 0) && (
                <span className="absolute top-1 -right-1 sm:static sm:ml-2 bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-full font-black">
                  {receivedChallenges.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 sm:flex-initial rounded-lg px-4 sm:px-8 py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs">
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all-teams" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTeams.map((team, index) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="clean-card group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <Avatar className="w-14 h-14 rounded-xl border-2 border-primary/20 shadow-sm overflow-hidden">
                        <AvatarImage src={team.logoURL || undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Shield className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      {team.captain === user?.uid && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-background">
                          <Crown className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-bold text-foreground">{team.stats?.wins || 0} Wins</p>
                      <p className="text-[12px] text-muted-foreground uppercase font-bold">{team.stats?.matchesPlayed || 0} Matches</p>
                    </div>
                  </div>
                  <h3 className="text-[20px] font-bold text-foreground mb-1">{team.name}</h3>
                  {team.description && (
                    <p className="text-muted-foreground text-[11px] mb-2 font-medium italic line-clamp-2">
                      {team.description}
                    </p>
                  )}
                  <p className="text-muted-foreground text-[13px] mb-6 flex items-center gap-1">
                    <Users className="w-4 h-4" /> {team.members.length} Members
                    {team.readyPlayers && team.readyPlayers.length > 0 && (
                      <span className="ml-2 text-emerald-500 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {team.readyPlayers.length} Ready
                      </span>
                    )}
                  </p>
                  
                  {!team.captain && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-red-600 font-bold text-[11px]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          NO LEADER: AUTO-DELETE IN {(() => {
                            const deleteTime = team.deleteAt?.toDate?.()?.getTime() || (typeof team.deleteAt === 'number' ? team.deleteAt : 0);
                            const seconds = Math.max(0, Math.floor((deleteTime - now) / 1000));
                            const mins = Math.floor(seconds / 60);
                            const secs = seconds % 60;
                            return `${mins}:${secs.toString().padStart(2, '0')}`;
                          })()}
                        </div>
                      </div>
                      <p className="text-[10px] text-red-500/80 mb-3 font-medium">
                        This team has no captain and will be deleted permanently soon.
                      </p>
                      {user && team.members.includes(user.uid) && (
                        <Button 
                          onClick={() => handleClaimCaptaincy(team.id)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase h-8 py-0"
                        >
                          Claim Leadership & Save Team
                        </Button>
                      )}
                    </div>
                  )}

                  {user && team.members.includes(user.uid) && team.captain && (
                    <div className="mb-6 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          team.readyPlayers?.includes(user.uid) ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
                        )} />
                        <span className="text-[11px] font-bold text-foreground">
                          {team.readyPlayers?.includes(user.uid) ? "READY FOR NEXT EVENT" : "MARK AVAILABILITY"}
                        </span>
                      </div>
                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleReadyStatus(team.id)}
                        className={cn(
                          "h-7 px-3 text-[10px] font-black uppercase rounded-lg",
                          team.readyPlayers?.includes(user.uid) 
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" 
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                      >
                        {team.readyPlayers?.includes(user.uid) ? "Unmark" : "I'm Ready"}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {user && team.members.includes(user.uid) ? (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => handleLeaveTeamRequest(team.id)}
                          className="flex-1 border-destructive/20 hover:bg-destructive/10 text-destructive font-bold h-11 rounded-lg"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Leave
                        </Button>
                        {team.captain === user.uid && (
                          <Button 
                            variant="outline" 
                            onClick={() => setIsManagingTeam(team)}
                            className="flex-1 border-primary text-primary hover:bg-primary/5 font-bold h-11 rounded-lg"
                          >
                            Manage
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button 
                        onClick={() => handleJoinTeam(team.id)}
                        variant="outline" 
                        disabled={teams.filter(t => t.members.includes(user?.uid || '') && t.captain !== user?.uid && !t.archived).length >= 4 || teams.filter(t => t.members.includes(user?.uid || '') && !t.archived).length >= 5}
                        className="flex-1 border-border hover:bg-muted text-foreground font-bold h-11 rounded-lg disabled:opacity-50"
                      >
                        {teams.filter(t => t.members.includes(user?.uid || '') && !t.archived).length >= 5 ? 'Limit Reached' : 'Join Team'}
                      </Button>
                    )}
                    
                    {user && team.captain !== user.uid && (
                      <Dialog open={isChallenging?.id === team.id} onOpenChange={(open) => setIsChallenging(open ? team : null)}>
                        <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-lg")}>
                          Challenge
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Challenge {team.name}</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="matchDate">Scheduled Date & Time</Label>
                              <Input 
                                id="matchDate" 
                                type="datetime-local"
                                value={challengeForm.date} 
                                onChange={(e) => setChallengeForm({...challengeForm, date: e.target.value})}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="matchCourt">Select Court</Label>
                              <Select 
                                value={challengeForm.courtId} 
                                onValueChange={(value) => {
                                  const court = courts.find(c => c.id === value);
                                  setChallengeForm({
                                    ...challengeForm, 
                                    courtId: value,
                                    location: court ? `${court.name}, ${court.district}` : challengeForm.location
                                  });
                                }}
                              >
                                <SelectTrigger id="matchCourt" className="h-11 rounded-lg border-border">
                                  <SelectValue placeholder="Choose a court location" />
                                </SelectTrigger>
                                <SelectContent>
                                  {courts.map((court) => (
                                    <SelectItem key={court.id} value={court.id}>
                                      {court.name} ({court.district})
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="custom">Other / Custom Location</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {challengeForm.courtId === 'custom' && (
                              <div className="grid gap-2">
                                <Label htmlFor="matchLoc">Custom Location</Label>
                                <Input 
                                  id="matchLoc" 
                                  placeholder="e.g., University Grounds"
                                  value={challengeForm.location} 
                                  onChange={(e) => setChallengeForm({...challengeForm, location: e.target.value})}
                                />
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSendChallenge} className="w-full bg-primary text-white font-bold">
                              Send Challenge
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-challenges" className="space-y-8">
          {activeMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="section-title">Upcoming Matches</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeMatches.map(match => (
                  <div key={match.id} className="clean-card border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between mb-4">
                      <Badge className="bg-primary text-white">Accepted</Badge>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="w-3 h-3" />
                        {new Date(match.scheduledDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <div className="text-center flex-1">
                        <p className="font-bold text-foreground">{match.fromTeamName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Challenger</p>
                      </div>
                      <div className="text-primary font-black text-xl italic">VS</div>
                      <div className="text-center flex-1">
                        <p className="font-bold text-foreground">{match.toTeamName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Defender</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                      <MapPin className="w-4 h-4" /> {match.location}
                    </div>
                    <Button className="w-full bg-primary text-white font-bold h-11 rounded-lg">
                      Record Result
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="section-title">Received Challenges</h3>
              {receivedChallenges.length > 0 ? (
                receivedChallenges.map(challenge => (
                  <div key={challenge.id} className="clean-card">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{challenge.fromTeamName}</p>
                          <p className="text-xs text-muted-foreground">Sent a challenge</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" /> {new Date(challenge.scheduledDate).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" /> {challenge.location}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleChallengeStatus(challenge.id, 'accepted')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 rounded-lg">
                        Accept
                      </Button>
                      <Button onClick={() => handleChallengeStatus(challenge.id, 'rejected')} variant="outline" className="flex-1 border-border text-destructive font-bold h-10 rounded-lg">
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm italic">No pending received challenges.</p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="section-title">Sent Challenges</h3>
              {sentChallenges.length > 0 ? (
                sentChallenges.map(challenge => (
                  <div key={challenge.id} className="clean-card opacity-80">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <Shield className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{challenge.toTeamName}</p>
                          <p className="text-xs text-muted-foreground">Waiting for response</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">Pending</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" /> {new Date(challenge.scheduledDate).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" /> {challenge.location}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm italic">No pending sent challenges.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="clean-card">
            <div className="flex items-center gap-3 mb-8">
              <History className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold">Team Match History</h3>
            </div>
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No completed matches yet.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!isManagingTeam} onOpenChange={(open) => !open && setIsManagingTeam(null)}>
        <DialogContent className="sm:max-w-md bg-card border-none shadow-2xl rounded-3xl overflow-hidden p-0">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                    <Avatar className="w-20 h-20 rounded-xl border-2 border-primary/20 shadow-sm overflow-hidden">
                      <AvatarImage src={isManagingTeam?.logoURL || undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Shield className="w-10 h-10" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    {isUploadingLogo && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-[9px] font-black uppercase text-primary tracking-widest"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Change Logo
                  </Button>
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-black text-foreground">Manage Squad</DialogTitle>
                  <p className="text-muted-foreground text-xs font-medium">Configure team identity and personnel.</p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editTeamName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Team Name</Label>
                  <Input 
                    id="editTeamName"
                    value={editingTeamName}
                    onChange={(e) => setEditingTeamName(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary"
                    placeholder="Enter team name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="editTeamDescription" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Team Motto/Description</Label>
                  <textarea 
                    id="editTeamDescription"
                    value={editingTeamDescription}
                    onChange={(e) => setEditingTeamDescription(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-xl border-none bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Tell the league about your squad..."
                  />
                </div>

                <Button 
                  onClick={handleUpdateTeamDetails}
                  disabled={isSubmitting || !editingTeamName.trim() || (editingTeamName.trim() === isManagingTeam?.name && editingTeamDescription.trim() === (isManagingTeam?.description || ''))}
                  className="w-full h-11 rounded-xl bg-primary text-white font-bold"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Identity Changes'}
                </Button>
              </div>

              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Share Team Code</h4>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black text-[9px] px-2">PRIVATE ACCESS</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-background text-foreground font-black text-xl tracking-[0.3em] px-4 py-3 rounded-xl border-2 border-primary/20 flex items-center justify-center">
                    {isManagingTeam?.teamCode || '---'}
                  </div>
                  {isManagingTeam?.teamCode ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-12 w-12 rounded-xl text-primary hover:bg-primary/10"
                      onClick={() => {
                        if (isManagingTeam?.teamCode) {
                          navigator.clipboard.writeText(isManagingTeam.teamCode);
                          toast.success('Code copied to clipboard!');
                        }
                      }}
                    >
                      <Copy className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-12 bg-primary/10 text-primary hover:bg-primary/20 font-black uppercase text-[10px] px-4 rounded-xl"
                      onClick={ensureTeamCode}
                    >
                      Generate
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium mt-3 text-center italic">
                  Players can use this code to join your squad instantly.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recruit Player</h4>
                  <Badge variant="secondary" className="text-[9px] font-bold h-4">BY EMAIL</Badge>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="player@example.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="h-10 rounded-xl bg-muted/30 border-none focus-visible:ring-primary"
                  />
                  <Button 
                    onClick={handleAddMemberByEmail}
                    disabled={isAddingMember || !memberEmail.trim()}
                    className="h-10 rounded-xl bg-primary text-white font-bold px-4"
                  >
                    {isAddingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">On-Court Squad</h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {isFetchingMembers ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
                      ))}
                    </div>
                  ) : teamMembers.length > 0 ? (
                    teamMembers.map((member) => (
                      <div key={member.uid} className="flex items-center justify-between p-3 bg-muted rounded-2xl border border-border group hover:border-primary/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                            <AvatarImage src={member.photoURL || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-black">
                              {member.displayName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-black text-foreground">{member.displayName}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{member.skillLevel || 'Pro Player'}</p>
                          </div>
                        </div>
                        {member.uid === isManagingTeam?.captain ? (
                          <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black uppercase py-1">
                            Current Captain
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button 
                              onClick={() => isManagingTeam && handleTransferCaptaincyRequest(isManagingTeam.id, member.uid)}
                              variant="ghost" 
                              className="text-[10px] font-black uppercase text-primary hover:bg-primary/10 px-2 h-7"
                              disabled={isRemovingMember}
                            >
                              <Crown className="w-3 h-3 mr-1" /> Transfer
                            </Button>
                            <Button 
                              onClick={() => isManagingTeam && handleRemoveMember(isManagingTeam.id, member.uid)}
                              variant="ghost" 
                              className="text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 px-2 h-7"
                              disabled={isRemovingMember}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-6 text-muted-foreground text-sm italic">Synchronizing squad data...</p>
                  )}
                </div>
              </div>

              {isManagingTeam && (
                <div className="pt-6 border-t border-border">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Tournament Readiness</h4>
                  <div className="bg-muted p-4 rounded-2xl border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground">Ready Players</p>
                          <p className="text-[10px] font-bold text-muted-foreground">{(isManagingTeam.readyPlayers || []).length} / {isManagingTeam.members.length} available</p>
                        </div>
                      </div>
                      {isManagingTeam.members.includes(user?.uid || '') && (
                        <Button 
                          onClick={() => handleToggleReadyStatus(isManagingTeam.id)}
                          variant={isManagingTeam.readyPlayers?.includes(user?.uid || '') ? "secondary" : "default"}
                          size="sm"
                          className="text-[10px] font-black uppercase h-8"
                        >
                          {isManagingTeam.readyPlayers?.includes(user?.uid || '') ? 'Unmark Ready' : 'Mark Ready'}
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {isManagingTeam.readyPlayers?.length ? (
                        teamMembers.filter(m => isManagingTeam.readyPlayers?.includes(m.uid)).map(m => (
                          <Badge key={m.uid} variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none text-[9px] font-black uppercase">
                            {m.displayName}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">No players marked as ready yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-border">
                <Button 
                  variant="ghost" 
                  onClick={() => isManagingTeam && handleDeleteTeamRequest(isManagingTeam.id)}
                  className="w-full text-red-500 hover:bg-red-500/10 font-black uppercase tracking-widest text-xs h-12 rounded-xl"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Archive Team
                </Button>
              </div>
            </div>
          </div>
          <div className="bg-muted p-4 border-t border-border flex justify-end px-8">
            <DialogClose className={cn(buttonVariants({ variant: "outline" }), "font-bold border-border")}>
              Close Manager
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <input
        type="file"
        ref={logoInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleLogoUpload(e, isManagingTeam?.id)}
      />
    </div>
  );
}
