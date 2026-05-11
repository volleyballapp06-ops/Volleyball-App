export interface UserProfile {
  uid: string;
  username?: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'player' | 'admin';
  tournamentReady?: boolean;
  location?: string;
  geohash?: string;
  lat?: number;
  lng?: number;
  bio?: string;
  stats?: {
    wins: number;
    tournamentMatches: number;
    friendlyMatches: number;
  };
  connections?: string[];
  canPostTournaments?: boolean;
  isBanned?: boolean;
  lastActive?: any;
  createdAt?: any;
}

export interface Team {
  id: string;
  name: string;
  captain: string;
  members: string[];
  logoURL?: string;
  teamCode: string;
  readyPlayers?: string[];
  deleteAt?: any;
  archived?: boolean;
  stats?: {
    matchesPlayed: number;
    wins: number;
  };
  createdAt?: any;
}

export interface Tournament {
  id: string;
  name: string;
  location: string;
  district: string;
  startDate: any;
  endDate: any;
  registrationDeadline: any;
  description: string;
  organizer: string;
  editors?: string[];
  organizerContact?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registrationClosed?: boolean;
  paymentStatus?: 'pending' | 'paid';
  createdBy?: string;
  createdAt?: any;
}

export interface TeamChallenge {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  fromTeamName: string;
  toTeamName: string;
  scheduledDate: string;
  location: string;
  courtId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt?: any;
}

export interface Court {
  id: string;
  name: string;
  location: string;
  geohash?: string;
  district: string;
  lat?: number;
  lng?: number;
  type: 'Outdoor' | 'Turf' | 'Indoor';
  access: 'Free' | 'Paid';
  facilities: string[];
  imageUrl: string;
  images?: string[];
  contact?: string;
  rating: number;
  ratingStats?: {
    sum: number;
    count: number;
  };
  createdBy?: string;
  createdAt?: any;
}

export interface SetScore {
  scoreA: number;
  scoreB: number;
}

export interface TournamentMatch {
  id: string;
  bracketId: string;
  roundIndex: number;
  matchIndex: number;
  teamAId?: string;
  teamBId?: string;
  teamAName?: string;
  teamBName?: string;
  scoreA?: number; // Total sets won or total score depending on format
  scoreB?: number;
  currentSetPoints?: SetScore;
  setHistory?: SetScore[];
  winnerId?: string;
  status: 'pending' | 'ongoing' | 'completed';
  nextMatchId?: string;
  startTime?: any;
  updatedAt?: any;
}

export interface TournamentRound {
  id: string;
  index: number;
  name: string;
  matches: TournamentMatch[];
}

export interface TournamentBracket {
  id: string;
  tournamentId: string;
  type: 'single' | 'round-robin';
  totalTeams: number;
  createdAt: any;
  updatedAt: any;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  teamId?: string;
  teamName?: string;
  userId?: string; // For individual registrations
  userName?: string;
  status: 'pending' | 'paid';
  createdAt: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'tournament' | 'match' | 'success';
  read: boolean;
  link?: string;
  createdAt: any;
}

export interface TournamentPostingRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface TournamentInquiry {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  fromId: string;
  fromName: string;
  toId: string;
  message: string;
  read: boolean;
  createdAt: any;
}
