import React, { useEffect, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, where, increment, getDocs, deleteDoc, limit } from 'firebase/firestore';
import { Trophy, MapPin, Calendar, Search, Filter, Plus, Loader2, CheckCircle2, Edit2, Trash2, MoreVertical, Zap, Users, XCircle, X, Phone, Mail, Crown, Shield, MessageSquare, AlertCircle, Sparkles, Send } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '../components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Tournament, Team, TournamentPostingRequest, TournamentInquiry } from '../types';
import BracketBuilder from '../components/BracketBuilder';
import TournamentLiveMatches from '../components/TournamentLiveMatches';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ConfirmModal } from '../components/ConfirmModal';



export default function Tournaments() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRegistrations, setUserRegistrations] = useState<{tournamentId: string, status: string}[]>([]);
  const [confirmTournament, setConfirmTournament] = useState<Tournament | null>(null);
  const [cancelConfirmTournament, setCancelConfirmTournament] = useState<Tournament | null>(null);
  const [detailsTournament, setDetailsTournament] = useState<Tournament | null>(null);
  const [registeredPlayers, setRegisteredPlayers] = useState<{userId: string, userName: string}[]>([]);
  const [manageSearchTerm, setManageSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{uid: string, displayName: string, photoURL?: string}[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [editorProfiles, setEditorProfiles] = useState<Record<string, {displayName: string, photoURL?: string}>>({});

  useEffect(() => {
    if (!detailsTournament?.editors || detailsTournament.editors.length === 0) return;

    const fetchProfiles = async () => {
      const newProfiles: Record<string, any> = { ...editorProfiles };
      let updated = false;

      for (const id of detailsTournament.editors) {
        if (!newProfiles[id]) {
          try {
            const docSnap = await getDoc(doc(db, 'users', id));
            if (docSnap.exists()) {
              newProfiles[id] = docSnap.data();
              updated = true;
            }
          } catch (error) {
            console.error(`Error fetching profile for ${id}:`, error);
          }
        }
      }

      if (updated) {
        setEditorProfiles(newProfiles);
      }
    };

    fetchProfiles();
  }, [detailsTournament?.editors]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [organizerRequests, setOrganizerRequests] = useState<TournamentPostingRequest[]>([]);
  const [myRequest, setMyRequest] = useState<TournamentPostingRequest | null>(null);
  const [inquiryTournament, setInquiryTournament] = useState<Tournament | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [myInquiries, setMyInquiries] = useState<TournamentInquiry[]>([]);

  const WHATSAPP_NUMBER = "919000000000"; // REPLACE WITH YOUR WHATSAPP NUMBER

  useEffect(() => {
    if (!user) {
      setOrganizerRequests([]);
      setMyRequest(null);
      setMyInquiries([]);
      return;
    }

    // Organizers see inquiries for their tournaments OR their own inquiries sent to others
    const qInquiries = query(
      collection(db, 'tournament_inquiries'), 
      where('toId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeInquiries = onSnapshot(qInquiries, (snapshot) => {
      setMyInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentInquiry)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournament_inquiries');
    });

    // Admin sees all requests
    if (profile?.role === 'admin') {
      const q = query(collection(db, 'tournament_posting_requests'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setOrganizerRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentPostingRequest)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tournament_posting_requests');
      });
      return unsubscribe;
    } else {
      // Regular user sees only their request
      const q = query(collection(db, 'tournament_posting_requests'), where('userId', '==', user.uid), limit(1));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setMyRequest({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TournamentPostingRequest);
        } else {
          setMyRequest(null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tournament_posting_requests');
      });
      return unsubscribe;
    }
  }, [user, profile]);

  const handleRequestPost = async () => {
    if (!user || !profile) return;
    if (!requestMessage.trim()) {
      toast.error("Please enter a message for the admin");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tournament_posting_requests'), {
        userId: user.uid,
        userName: profile.displayName,
        userEmail: profile.email,
        message: requestMessage,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      toast.success("Request sent successfully! Admin will contact you soon.");
      setIsRequesting(false);
      setRequestMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tournament_posting_requests');
      toast.error("Failed to send request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessRequest = async (request: TournamentPostingRequest, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'tournament_posting_requests', request.id), {
        status,
        updatedAt: serverTimestamp()
      });

      if (status === 'approved') {
        const userRef = doc(db, 'users', request.userId);
        await updateDoc(userRef, {
          canPostTournaments: true
        });
        toast.success(`User ${request.userName} approved to post tournaments`);
      } else {
        toast.info(`Request from ${request.userName} rejected`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tournament_posting_requests');
      toast.error("Failed to process request");
    }
  };

  const handleSendInquiry = async () => {
    if (!user || !profile || !inquiryTournament) return;
    if (!inquiryMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tournament_inquiries'), {
        tournamentId: inquiryTournament.id,
        tournamentTitle: inquiryTournament.name,
        fromId: user.uid,
        fromName: profile.displayName,
        toId: inquiryTournament.organizer,
        message: inquiryMessage,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      // Also send a notification to the organizer
      await addDoc(collection(db, 'notifications'), {
        userId: inquiryTournament.organizer,
        title: 'New Tournament Inquiry',
        message: `${profile.displayName} messaged you about ${inquiryTournament.name}`,
        type: 'tournament',
        read: false,
        link: `/tournaments`,
        createdAt: serverTimestamp(),
      });

      toast.success("Message sent to organizer!");
      setInquiryTournament(null);
      setInquiryMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tournament_inquiries');
      toast.error("Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkInquiryRead = async (inquiryId: string) => {
    try {
      await updateDoc(doc(db, 'tournament_inquiries', inquiryId), {
        read: true
      });
    } catch (error) {
      console.error("Failed to mark inquiry as read", error);
    }
  };

  useEffect(() => {
    const searchUsers = async () => {
      if (!user) return;
      setIsSearchingUsers(true);
      try {
        const usersRef = collection(db, 'users');
        let results: any[] = [];
        
        if (!manageSearchTerm.trim()) {
          // If no search term, show some users
          const q = query(usersRef, limit(10));
          const snapshot = await getDocs(q);
          results = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
          } as any));
        } else {
          const term = manageSearchTerm.trim().toLowerCase();
          
          // Try to get some users to filter client-side for better UX
          // We can't do case-insensitive search easily in Firestore without a normalized field
          // So we try prefix search with both original and capitalized, and also exact email
          
          const queries = [
            // Original prefix
            query(usersRef, where('displayName', '>=', manageSearchTerm.trim()), where('displayName', '<=', manageSearchTerm.trim() + '\uf8ff'), limit(10)),
            // Capitalized prefix
            query(usersRef, where('displayName', '>=', manageSearchTerm.trim().charAt(0).toUpperCase() + manageSearchTerm.trim().slice(1)), where('displayName', '<=', manageSearchTerm.trim().charAt(0).toUpperCase() + manageSearchTerm.trim().slice(1) + '\uf8ff'), limit(10)),
            // Exact email
            query(usersRef, where('email', '==', manageSearchTerm.trim().toLowerCase()), limit(5))
          ];
          
          const snapshots = await Promise.all(queries.map(q => getDocs(q)));
          const resultMap = new Map();
          
          snapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
              resultMap.set(doc.id, { uid: doc.id, ...doc.data() });
            });
          });
          
          results = Array.from(resultMap.values());
          
          // Client-side case-insensitive filter to refine
          results = results.filter(u => 
            u.displayName?.toLowerCase().includes(term) || 
            u.email?.toLowerCase().includes(term)
          );
        }

        setUserSearchResults(results);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, manageSearchTerm.trim() ? 500 : 0);
    return () => clearTimeout(debounceTimer);
  }, [manageSearchTerm]);

  const toggleEditor = async (targetUserId: string) => {
    if (!detailsTournament) return;
    
    const currentEditors = detailsTournament.editors || [];
    const isAlreadyEditor = currentEditors.includes(targetUserId);
    
    let newEditors;
    if (isAlreadyEditor) {
      newEditors = currentEditors.filter(id => id !== targetUserId);
    } else {
      newEditors = [...currentEditors, targetUserId];
    }

    try {
      await updateDoc(doc(db, 'tournaments', detailsTournament.id), {
        editors: newEditors
      });
      setDetailsTournament({ ...detailsTournament, editors: newEditors });
      toast.success(isAlreadyEditor ? 'Manager removed' : 'Manager added');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${detailsTournament.id}`);
      toast.error("Failed to update permissions");
    }
  };
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    type: 'delete' | 'cancel' | null;
    id: string | null;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: '',
    description: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    district: '',
    startDate: '',
    endDate: '',
    description: '',
    organizer: '',
    organizerContact: '',
    registrationDeadline: '',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed' | 'cancelled',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      district: '',
      startDate: '',
      endDate: '',
      description: '',
      organizer: '',
      organizerContact: '',
      registrationDeadline: '',
      status: 'upcoming',
    });
    setEditingTournamentId(null);
  };

  const handleEditOpen = (tournament: Tournament) => {
    setFormData({
      name: tournament.name,
      location: tournament.location,
      district: tournament.district,
      startDate: tournament.startDate?.toDate ? tournament.startDate.toDate().toISOString().split('T')[0] : '',
      endDate: tournament.endDate?.toDate ? tournament.endDate.toDate().toISOString().split('T')[0] : '',
      description: tournament.description || '',
      organizer: tournament.organizer,
      organizerContact: tournament.organizerContact || '',
      registrationDeadline: tournament.registrationDeadline?.toDate ? tournament.registrationDeadline.toDate().toISOString().split('T')[0] : '',
      status: tournament.status || 'upcoming',
    });
    setEditingTournamentId(tournament.id);
    setIsEditing(true);
  };

  const handleDeleteTournamentRequest = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      type: 'delete',
      id,
      title: 'Delete Tournament',
      description: 'Are you sure you want to delete this tournament? This action cannot be undone.'
    });
  };

  const handleDeleteTournament = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tournaments', id));
      toast.success('Tournament deleted successfully');
    } catch (error) {
      console.error('Delete failed', error);
      toast.error('Failed to delete tournament');
    }
  };

  const handleCancelTournamentRequest = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      type: 'cancel',
      id,
      title: 'Cancel Tournament',
      description: 'Are you sure you want to cancel this tournament? This will notify registered players.'
    });
  };

  const handleCancelTournament = async (id: string) => {
    try {
      await updateDoc(doc(db, 'tournaments', id), {
        status: 'cancelled'
      });
      toast.success('Tournament cancelled successfully');
    } catch (error) {
      console.error('Cancel failed', error);
      toast.error('Failed to cancel tournament');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('startDate', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
        .filter(t => t.paymentStatus === 'paid' || t.createdBy === user?.uid || profile?.role === 'admin');
      
      setTournaments(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
    });

    let unsubscribeRegs: (() => void) | null = null;
    if (user) {
      const regQ = query(collection(db, 'tournament_registrations'), where('userId', '==', user.uid));
      unsubscribeRegs = onSnapshot(regQ, (snapshot) => {
        setUserRegistrations(snapshot.docs.map(doc => ({
          tournamentId: doc.data().tournamentId,
          status: doc.data().status || 'Registered'
        })));
      });
    }

    return () => {
      unsubscribe();
      if (unsubscribeRegs) unsubscribeRegs();
    };
  }, [user, profile]);

  useEffect(() => {
    if (!detailsTournament) {
      setRegisteredPlayers([]);
      return;
    }

    const q = query(
      collection(db, 'tournament_registrations'),
      where('tournamentId', '==', detailsTournament.id),
      orderBy('userName', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players = snapshot.docs.map(doc => ({
        userId: doc.data().userId,
        userName: doc.data().userName
      }));
      setRegisteredPlayers(players);
    }, (error) => {
      console.error("Error fetching registered players:", error);
    });

    return () => unsubscribe();
  }, [detailsTournament]);

  const [userCaptainedTeams, setUserCaptainedTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isSelectingTeam, setIsSelectingTeam] = useState(false);

  useEffect(() => {
    if (!user) {
      setUserCaptainedTeams([]);
      return;
    }

    const q = query(collection(db, 'teams'), where('captain', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setUserCaptainedTeams(teams);
      if (teams.length > 0) {
        setSelectedTeamId(teams[0].id);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleRegister = async (tournament: Tournament) => {
    if (!user || !profile) {
      toast.error('Please sign in to register');
      return;
    }

    if (userCaptainedTeams.length === 0) {
      toast.error('Only team captains can enroll for tournaments. Please create a team first.');
      return;
    }

    if (tournament.registrationClosed) {
      toast.error('Registration for this tournament is now closed.');
      return;
    }

    if (userRegistrations.some(r => r.tournamentId === tournament.id)) {
      toast.info('Your team is already registered');
      return;
    }

    // If user has multiple teams, we should let them select one
    if (userCaptainedTeams.length > 1 && !isSelectingTeam) {
      setConfirmTournament(tournament);
      setIsSelectingTeam(true);
      return;
    }

    const teamToRegister = userCaptainedTeams.find(t => t.id === (selectedTeamId || userCaptainedTeams[0]?.id));
    if (!teamToRegister) {
      toast.error('Please select a valid team');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Add registration record
      await addDoc(collection(db, 'tournament_registrations'), {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        teamId: teamToRegister.id,
        teamName: teamToRegister.name,
        userId: user.uid, // Still track who registered it
        userName: profile.displayName,
        status: 'Registered',
        createdAt: serverTimestamp()
      });

      // 2. Update user profile - although it might be better to update team stats later
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'stats.tournamentMatches': increment(1),
        registeredTournaments: [...(profile.registeredTournaments || []), tournament.id]
      });

      toast.success(`Team ${teamToRegister.name} successfully registered for ${tournament.name}`);
      setConfirmTournament(null);
      setIsSelectingTeam(false);
    } catch (error) {
      console.error('Registration failed', error);
      toast.error('Failed to register. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRegistration = async (tournament: Tournament) => {
    if (!user || !profile) return;

    setIsSubmitting(true);
    try {
      // 1. Find and delete registration record
      const regQ = query(
        collection(db, 'tournament_registrations'), 
        where('tournamentId', '==', tournament.id),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(regQ);
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, 'tournament_registrations', docSnap.id));
      }

      // 2. Update user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'stats.tournamentMatches': increment(-1),
        registeredTournaments: (profile.registeredTournaments || []).filter(id => id !== tournament.id)
      });

      toast.success(`Registration cancelled for ${tournament.name}`);
      setCancelConfirmTournament(null);
    } catch (error) {
      console.error('Cancellation failed', error);
      toast.error('Failed to cancel registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostTournament = async () => {
    if (!user) {
      toast.error('Please sign in to post a tournament');
      return;
    }

    if (user.email !== 'volleyballapp06@gmail.com') {
      toast.error('Only authorized personnel can post tournaments');
      return;
    }

    if (!formData.name || !formData.location || !formData.startDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTournamentId) {
        // Update existing
        await updateDoc(doc(db, 'tournaments', editingTournamentId), {
          ...formData,
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
          registrationDeadline: formData.registrationDeadline ? new Date(formData.registrationDeadline) : new Date(formData.startDate),
        });
        toast.success('Tournament updated successfully');
        setIsEditing(false);
        resetForm();
        setIsSubmitting(false);
        return;
      }

      // 1. Create tournament in Firestore
      await addDoc(collection(db, 'tournaments'), {
        ...formData,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        registrationDeadline: formData.registrationDeadline ? new Date(formData.registrationDeadline) : new Date(formData.startDate),
        status: formData.status || 'upcoming',
        paymentStatus: 'paid', // Mark as paid automatically
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      toast.success('Tournament posted successfully!');
      setIsPosting(false);
      resetForm();
    } catch (error: any) {
      console.error('Posting failed', error);
      toast.error(error.message || 'Failed to post tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.district.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirmAction = () => {
    if (!confirmConfig.id || !confirmConfig.type) return;

    switch (confirmConfig.type) {
      case 'delete':
        handleDeleteTournament(confirmConfig.id);
        break;
      case 'cancel':
        handleCancelTournament(confirmConfig.id);
        break;
    }

    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
  };

  const canPost = profile?.role === 'admin' || profile?.canPostTournaments || user?.email === 'volleyballapp06@gmail.com';

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground uppercase italic px-1">
            Tournaments
          </h1>
          <p className="text-muted-foreground text-sm md:text-base px-1">
            Discover and participate in volleyball events across Tamil Nadu.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search tournaments..." 
              className="pl-10 h-11 bg-card border-border focus:ring-primary rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {canPost ? (
            <Dialog open={isPosting} onOpenChange={setIsPosting}>
              <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl active:scale-95 transition-transform")}>
                <Plus className="w-4 h-4 mr-2" />
                Post Tournament
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Post a Tournament</DialogTitle>
                  <DialogDescription>
                    Fill in the details below to list your tournament.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="t-name">Tournament Name *</Label>
                    <Input 
                      id="t-name" 
                      placeholder="e.g. Summer Smash 2024"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="t-location">Location *</Label>
                      <Input 
                        id="t-location" 
                        placeholder="e.g. Marina Beach"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="t-district">District</Label>
                      <Input 
                        id="t-district" 
                        placeholder="e.g. Chennai"
                        value={formData.district}
                        onChange={(e) => setFormData({...formData, district: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="t-start">Start Date *</Label>
                      <Input 
                        id="t-start" 
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="t-end">End Date</Label>
                      <Input 
                        id="t-end" 
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="t-deadline">Registration Deadline *</Label>
                    <Input 
                      id="t-deadline" 
                      type="date"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({...formData, registrationDeadline: e.target.value})}
                    />
                    <p className="text-[10px] text-muted-foreground font-medium">Players cannot register after this date.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="t-organizer">Organizer Name</Label>
                      <Input 
                        id="t-organizer" 
                        placeholder="e.g. Chennai Spikers Club"
                        value={formData.organizer}
                        onChange={(e) => setFormData({...formData, organizer: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="t-contact">Organizer Contact (Phone/Email)</Label>
                      <Input 
                        id="t-contact" 
                        placeholder="e.g. +91 98765 43210"
                        value={formData.organizerContact}
                        onChange={(e) => setFormData({...formData, organizerContact: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Tournament Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(val: any) => setFormData({...formData, status: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="t-desc">Description</Label>
                    <textarea 
                      id="t-desc"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Tell players about the tournament, prizes, etc."
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handlePostTournament} 
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white font-bold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      'Post Tournament'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : user && (
            <Dialog open={isRequesting} onOpenChange={setIsRequesting}>
              <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "h-11 border-primary/20 text-primary hover:bg-primary hover:text-white font-bold rounded-xl active:scale-95 transition-all shadow-sm")}>
                <Sparkles className="w-4 h-4 mr-2" />
                {myRequest ? 'Status: ' + myRequest.status.toUpperCase() : 'Request to Post'}
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Become a Tournament Host</DialogTitle>
                  <DialogDescription>
                    Send a request to the admin to get permission to post tournaments.
                  </DialogDescription>
                </DialogHeader>
                
                {myRequest ? (
                  <div className="py-6 text-center space-y-4">
                    <div className={cn(
                      "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
                      myRequest.status === 'pending' ? "bg-amber-500/10 text-amber-500" :
                      myRequest.status === 'approved' ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-destructive/10 text-destructive"
                    )}>
                      {myRequest.status === 'pending' ? <Loader2 className="w-8 h-8 animate-spin" /> : 
                       myRequest.status === 'approved' ? <CheckCircle2 className="w-8 h-8" /> : 
                       <XCircle className="w-8 h-8" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-1 uppercase italic">Request {myRequest.status}</h4>
                      <p className="text-sm text-muted-foreground">
                        {myRequest.status === 'pending' ? "Your request is under review. Please wait for an admin to process it." :
                         myRequest.status === 'approved' ? "You now have permission to post tournaments!" :
                         "Your request was not approved at this time. Please contact support for more information."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="request-msg">Your Inquiry Message</Label>
                      <textarea 
                        id="request-msg"
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Tell us about the tournament you want to host and your experience..."
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                      />
                    </div>
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                        <p className="text-xs text-primary/80 leading-relaxed font-medium">
                          After submitting, the admin will review your inquiry and may contact you for further details regarding the tournament post.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!myRequest && (
                  <DialogFooter>
                    <Button 
                      className="w-full font-bold uppercase tracking-widest"
                      onClick={handleRequestPost}
                      disabled={isSubmitting || !requestMessage.trim()}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Send Inquiry Request'}
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isEditing} onOpenChange={(open) => {
            setIsEditing(open);
            if (!open) resetForm();
          }}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Tournament</DialogTitle>
                <DialogDescription>
                  Update the details for your tournament.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-t-name">Tournament Name *</Label>
                  <Input 
                    id="edit-t-name" 
                    placeholder="e.g. Summer Smash 2024"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-t-location">Location *</Label>
                    <Input 
                      id="edit-t-location" 
                      placeholder="e.g. Marina Beach"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-t-district">District</Label>
                    <Input 
                      id="edit-t-district" 
                      placeholder="e.g. Chennai"
                      value={formData.district}
                      onChange={(e) => setFormData({...formData, district: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-t-start">Start Date *</Label>
                    <Input 
                      id="edit-t-start" 
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-t-end">End Date</Label>
                    <Input 
                      id="edit-t-end" 
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-t-deadline">Registration Deadline *</Label>
                  <Input 
                    id="edit-t-deadline" 
                    type="date"
                    value={formData.registrationDeadline}
                    onChange={(e) => setFormData({...formData, registrationDeadline: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-t-organizer">Organizer Name</Label>
                  <Input 
                    id="edit-t-organizer" 
                    placeholder="e.g. Chennai Spikers Club"
                    value={formData.organizer}
                    onChange={(e) => setFormData({...formData, organizer: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-t-desc">Description</Label>
                  <textarea 
                    id="edit-t-desc"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Tell players about the tournament, prizes, etc."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handlePostTournament} 
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white font-bold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Admin/Organizer Dashboards */}
      <div className="flex flex-col gap-6 mb-8">
        {/* Organizer Requests (Admin Only) */}
        {profile?.role === 'admin' && organizerRequests.filter(r => r.status === 'pending').length > 0 && (
          <section className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000 -rotate-12 group-hover:rotate-0">
               <Shield className="w-24 h-24 text-amber-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Posting Requests
                </h2>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold uppercase tracking-tighter text-[10px]">
                  {organizerRequests.filter(r => r.status === 'pending').length} ACTION
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organizerRequests.filter(r => r.status === 'pending').map((request) => (
                  <div key={request.id} className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm truncate">{request.userName}</h4>
                        <p className="text-[10px] text-muted-foreground truncate uppercase font-black tracking-widest">{request.userEmail}</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-xl border border-border mb-4">
                      <p className="text-[11px] leading-relaxed italic text-muted-foreground">
                        "{request.message}"
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] h-8 rounded-xl"
                        onClick={() => handleProcessRequest(request, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1 font-bold text-[10px] h-8 rounded-xl"
                        onClick={() => handleProcessRequest(request, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tournament Inquiries (Organizers Only) */}
        {myInquiries.length > 0 && (
          <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000 -rotate-12 group-hover:rotate-0">
               <MessageSquare className="w-24 h-24 text-emerald-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> Received Inquiries
                </h2>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-tighter text-[10px]">
                  {myInquiries.filter(i => !i.read).length} UNREAD
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myInquiries.map((inquiry) => (
                  <div 
                    key={inquiry.id} 
                    className={cn(
                      "bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all",
                      inquiry.read ? "border-white/5 opacity-60" : "border-emerald-500/30 ring-1 ring-emerald-500/10"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs truncate">{inquiry.fromName}</h4>
                          <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest truncate">{inquiry.tournamentTitle}</p>
                        </div>
                      </div>
                      {!inquiry.read && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      )}
                    </div>
                    <div className="bg-muted/30 p-3 rounded-xl border border-white/5 mb-4 max-h-32 overflow-y-auto">
                      <p className="text-[11px] leading-relaxed italic text-muted-foreground whitespace-pre-wrap">
                        "{inquiry.message}"
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!inquiry.read && (
                        <Button 
                          className="flex-1 bg-white/[0.05] hover:bg-white/10 text-white font-bold text-[9px] h-8 rounded-xl border border-white/5"
                          onClick={() => handleMarkInquiryRead(inquiry.id)}
                        >
                          Mark as Read
                        </Button>
                      )}
                      <a 
                        href={`mailto:${inquiry.id}?subject=Tournament Inquiry: ${inquiry.tournamentTitle}`}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "flex-1 font-bold text-[9px] h-8 rounded-xl border-white/5 flex items-center justify-center transition-all"
                        )}
                      >
                        Reply via Email
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredTournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament, index) => (
            <motion.div
              key={tournament.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="clean-card group hover:border-primary/50 transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="date-badge shrink-0">
                    {new Date(tournament.startDate?.toDate()).getDate()} 
                    <span>{new Date(tournament.startDate?.toDate()).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[18px] font-bold text-foreground group-hover:text-primary transition-colors">
                          {tournament.name}
                        </h3>
                        <Badge className={`${
                          tournament.status === 'upcoming' ? 'bg-primary/10 text-primary border-primary/20' : 
                          tournament.status === 'ongoing' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          tournament.status === 'completed' ? 'bg-muted text-muted-foreground border-border' : 
                          tournament.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted text-muted-foreground border-border'
                        } border shadow-none text-[10px] font-bold px-2 py-0.5 flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            tournament.status === 'upcoming' ? 'bg-primary' : 
                            tournament.status === 'ongoing' ? 'bg-emerald-500' : 
                            tournament.status === 'completed' ? 'bg-muted-foreground' : 
                            'bg-destructive'
                          }`} />
                          {tournament.status.toUpperCase()}
                        </Badge>
                      </div>

                      {(user?.uid === tournament.createdBy || profile?.role === 'admin' || user?.email === 'volleyballapp06@gmail.com') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditOpen(tournament)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {tournament.status !== 'cancelled' && (
                              <DropdownMenuItem 
                                onClick={() => handleCancelTournamentRequest(tournament.id)}
                                className="text-amber-500"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Tournament
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDeleteTournamentRequest(tournament.id)} className="text-red-500">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {tournament.location}, {tournament.district}
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        {tournament.organizer}
                      </span>
                    </div>
                  </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
                        <Button 
                          variant="outline" 
                          className="flex-1 font-bold h-10 rounded-xl border-white/5 hover:bg-white/10"
                          onClick={() => setDetailsTournament(tournament)}
                        >
                          Details
                        </Button>
                        {user?.uid !== tournament.createdBy && (
                          <Button 
                            variant="outline" 
                            className="w-full sm:w-10 h-10 p-0 rounded-xl border-white/5 hover:bg-white/10 transition-all hover:text-primary active:scale-95 group flex items-center justify-center shrink-0"
                            onClick={() => {
                              setInquiryTournament(tournament);
                              setInquiryMessage("");
                            }}
                          >
                            <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span className="sm:hidden ml-2 font-bold text-[10px] uppercase tracking-widest">Message Organizer</span>
                          </Button>
                        )}
                      </div>

                      {(() => {
                        const registration = userRegistrations.find(r => r.tournamentId === tournament.id);
                        if (registration) {
                          if (registration.status === 'Pending') {
                            return (
                              <Button className="bg-muted text-muted-foreground font-bold border border-border" disabled>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Pending
                              </Button>
                            );
                          }
                          return (
                            <div className="flex flex-col gap-2">
                              <Button className="bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20 cursor-default" disabled>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Registered
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setCancelConfirmTournament(tournament)}
                                className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 font-bold text-[12px]"
                                disabled={isSubmitting}
                              >
                                Cancel Registration
                              </Button>
                            </div>
                          );
                        }
                        
                        // Not Registered state
                        const isRegistrationClosed = (tournament.registrationDeadline ? 
                          new Date(tournament.registrationDeadline.toDate()) < new Date() :
                          new Date(tournament.startDate.toDate()) < new Date()) || tournament.registrationClosed;

                        return (
                          <div className="flex flex-col gap-2">
                            <Button 
                              className={cn(
                                "font-black uppercase tracking-widest h-12 rounded-xl transition-all shadow-lg",
                                isRegistrationClosed ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                              )}
                              onClick={() => !isRegistrationClosed && setConfirmTournament(tournament)}
                              disabled={isSubmitting || tournament.status !== 'upcoming' || !user || isRegistrationClosed}
                            >
                              {isRegistrationClosed ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reg. Closed
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4 mr-2" />
                                  {!user ? 'Sign in' : 'Join Now'}
                                </>
                              )}
                            </Button>
                            {isRegistrationClosed && !userRegistrations.some(r => r.tournamentId === tournament.id) && (
                              <p className="text-[9px] text-center font-black uppercase text-red-500 tracking-tighter">
                                {tournament.registrationClosed ? "Registration Closed by Organizer" : "Registration Deadline Passed"}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground">No tournaments found</h3>
          <p className="text-muted-foreground">Try searching for something else or check back later.</p>
        </div>
      )}

      <Dialog open={!!detailsTournament} onOpenChange={(open) => !open && setDetailsTournament(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{detailsTournament?.name}</DialogTitle>
            <DialogDescription>
              Organized by {detailsTournament?.organizer}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="info" className="rounded-lg font-bold text-xs uppercase tracking-widest">Info</TabsTrigger>
              <TabsTrigger value="bracket" className="rounded-lg font-bold text-xs uppercase tracking-widest gap-2">
                <Trophy className="w-3 h-3" /> Bracket
              </TabsTrigger>
              <TabsTrigger value="players" className="rounded-lg font-bold text-xs uppercase tracking-widest">Players</TabsTrigger>
              <TabsTrigger 
                value="manage" 
                disabled={!(detailsTournament?.createdBy === user?.uid || profile?.role === 'admin')}
                className="rounded-lg font-bold text-xs uppercase tracking-widest"
              >
                Manage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-6">
              {detailsTournament && <TournamentLiveMatches tournamentId={detailsTournament.id} />}
              
              <div className="text-sm">
                <h4 className="font-bold mb-1">Description</h4>
                <p className="text-muted-foreground">{detailsTournament?.description || 'No description provided.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-bold">Location</h4>
                  <p className="text-muted-foreground">{detailsTournament?.location}</p>
                </div>
                <div>
                  <h4 className="font-bold">District</h4>
                  <p className="text-muted-foreground">{detailsTournament?.district}</p>
                </div>
              </div>

              {detailsTournament?.organizerContact && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Organizer Contact</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {detailsTournament.organizerContact.includes('@') ? (
                        <Mail className="w-4 h-4 text-primary" />
                      ) : (
                        <Phone className="w-4 h-4 text-primary" />
                      )}
                      <span className="font-medium">{detailsTournament.organizerContact}</span>
                    </div>
                    {(!detailsTournament.organizerContact.includes('@')) && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white px-3 font-bold text-[10px] uppercase gap-1.5"
                        onClick={() => {
                          const msg = `Hello, I'm interested in the ${detailsTournament.name} tournament.`;
                          const cleanPhone = detailsTournament.organizerContact.replace(/\D/g, '');
                          const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                          window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bracket" className="mt-4">
              {detailsTournament && (
                <BracketBuilder 
                  tournamentId={detailsTournament.id}
                  isOrganizer={
                    detailsTournament.createdBy === user?.uid || 
                    profile?.role === 'admin' || 
                    (detailsTournament.editors || []).includes(user?.uid || '')
                  }
                  teams={registeredPlayers}
                />
              )}
            </TabsContent>

            <TabsContent value="players" className="mt-4 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-bold text-foreground">Registered Players</h4>
                <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold">
                  {registeredPlayers.length} Joined
                </Badge>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {registeredPlayers.length > 0 ? (
                  registeredPlayers.map((player) => (
                    <div 
                      key={player.userId}
                      className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border border-border/50"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                          {player.userName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{player.userName}</span>
                      {player.userId === user?.uid && (
                        <Badge variant="outline" className="ml-auto text-[9px] font-bold uppercase border-primary/20 text-primary bg-primary/5">
                          You
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
                    <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No players registered yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manage" className="mt-4 space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold mb-2">Assign Bracket Managers</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Allow other players to manage scores and brackets for this tournament.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search users by name..." 
                      className="pl-10"
                      value={manageSearchTerm}
                      onChange={(e) => setManageSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {isSearchingUsers ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : userSearchResults.length > 0 && (
                  <div className="space-y-2 border border-border rounded-xl p-2 bg-muted/30">
                    {userSearchResults.map(u => (
                      <div key={u.uid} className="flex items-center justify-between p-2 hover:bg-background rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={u.photoURL} />
                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                              {u.displayName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{u.displayName}</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant={detailsTournament?.editors?.includes(u.uid) ? "destructive" : "default"}
                          disabled={u.uid === user?.uid}
                          className="h-7 text-[10px] font-bold"
                          onClick={() => toggleEditor(u.uid)}
                        >
                          {detailsTournament?.editors?.includes(u.uid) ? "Remove" : "Add Manager"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Managers</h4>
                  <div className="space-y-2">
                    {detailsTournament?.editors && detailsTournament.editors.length > 0 ? (
                      detailsTournament.editors.map((editorId) => {
                        const profile = editorProfiles[editorId];
                        return (
                          <div key={editorId} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                            <div className="flex items-center gap-3">
                              {profile?.photoURL ? (
                                <Avatar className="w-8 h-8 rounded-full">
                                  <AvatarImage src={profile.photoURL} />
                                  <AvatarFallback>{profile.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                  <Users className="w-4 h-4" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{profile?.displayName || 'Loading...'}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{editorId.substring(0, 8)}...</span>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 text-destructive hover:bg-destructive/10"
                              onClick={() => toggleEditor(editorId)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-6 border border-dashed border-border rounded-xl">
                        <p className="text-[11px] text-muted-foreground">No managers assigned yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <DialogClose render={<Button variant="outline">Close</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cancelConfirmTournament} onOpenChange={(open) => !open && setCancelConfirmTournament(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your registration? This action will update your profile stats.
            </DialogDescription>
          </DialogHeader>
            {cancelConfirmTournament && (
              <div className="space-y-6 py-4">
                <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/20">
                  <h4 className="text-xs font-bold text-destructive uppercase tracking-wider mb-2">Tournament Details</h4>
                  <p className="font-bold text-lg mb-1">{cancelConfirmTournament.name}</p>
                  <p className="text-sm text-destructive/70">{cancelConfirmTournament.location}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Profile Updates</h4>
                  <div className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium block text-foreground">Tournament Matches</span>
                        <span className="text-[11px] text-destructive font-bold">Will decrease by 1</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-muted-foreground text-xs line-through">{profile?.stats?.tournamentMatches || 0}</span>
                      <span className="text-destructive">{(profile?.stats?.tournamentMatches || 0) - 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelConfirmTournament(null)} disabled={isSubmitting}>
              Keep Registration
            </Button>
            <Button 
              variant="destructive"
              className="font-bold"
              onClick={() => cancelConfirmTournament && handleCancelRegistration(cancelConfirmTournament)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmTournament} onOpenChange={(open) => {
        if (!open) {
          setConfirmTournament(null);
          setIsSelectingTeam(false);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Registration</DialogTitle>
            <DialogDescription>
              {userCaptainedTeams.length > 0 
                ? "Select a team to enroll in this tournament." 
                : "Only team captains can register for tournaments."}
            </DialogDescription>
          </DialogHeader>
          {confirmTournament && (
            <div className="space-y-6 py-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Tournament Details</h4>
                <p className="font-bold text-lg mb-1">{confirmTournament.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {confirmTournament.location}, {confirmTournament.district}
                </div>
              </div>

              {userCaptainedTeams.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Your Team</Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                      <SelectContent>
                        {userCaptainedTeams.map(team => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registration Info</h4>
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Crown className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium block text-foreground">Enrolling as Captain</span>
                          <span className="text-[11px] text-primary font-bold">Team: {userCaptainedTeams.find(t => t.id === selectedTeamId)?.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                  <div className="flex items-center gap-3 text-orange-500 mb-2">
                    <Shield className="w-5 h-5" />
                    <p className="font-bold text-sm">Action Required</p>
                  </div>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    You don't have any teams where you are the captain. Please create a team or be appointed as captain to register for tournaments.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmTournament(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            {userCaptainedTeams.length > 0 ? (
              <Button 
                className="bg-primary hover:bg-primary/90 text-white font-bold"
                onClick={() => confirmTournament && handleRegister(confirmTournament)}
                disabled={isSubmitting || !selectedTeamId}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Registering...
                  </>
                ) : (
                  'Confirm Enrollment'
                )}
              </Button>
            ) : (
              <Link 
                to="/teams" 
                className={cn(buttonVariants({ variant: "default" }), "bg-primary hover:bg-primary/90 text-white font-bold h-9 px-6 rounded-lg uppercase tracking-widest text-[10px] inline-flex items-center justify-center")}
              >
                Go to Teams
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Inquiry Dialog */}
      <Dialog open={!!inquiryTournament} onOpenChange={(open) => !open && setInquiryTournament(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-tighter italic font-black">
              <MessageSquare className="w-5 h-5 text-primary" />
              Inquiry <span className="text-primary">Box</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Tournament: <span className="text-white">{inquiryTournament?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-3">
              <Label htmlFor="inquiry-msg" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Message</Label>
              <textarea 
                id="inquiry-msg"
                className="flex min-h-[140px] w-full rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                placeholder="Ask registration details, fees, or anything else..."
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
              />
            </div>
            <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 flex gap-3">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-500/80 font-bold leading-relaxed italic">
                The organizer will contact you regarding this inquiry via your registered profile or email.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full font-black uppercase tracking-widest h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 active:scale-95 transition-all"
              onClick={handleSendInquiry}
              disabled={isSubmitting || !inquiryMessage.trim()}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Send Inquiry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
