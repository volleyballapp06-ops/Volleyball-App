import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Trophy, MapPin, Users, User, Home, LogOut, Menu, X, Settings, LayoutDashboard, ArrowRight, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { auth, signInWithPopup, googleProvider, signOut } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import NotificationCenter from './NotificationCenter';
import { OnboardingTour } from './OnboardingTour';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Tournaments', path: '/tournaments', icon: Trophy },
    { name: 'Nearby Courts', path: '/courts', icon: MapPin },
    { name: 'Teams', path: '/teams', icon: Users },
    { name: 'Connections', path: '/players', icon: Users },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const [detectedLocation, setDetectedLocation] = React.useState<string | null>(null);

  const detectLocation = React.useCallback(async (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) toast.error('Geolocation is not supported by your browser');
      return;
    }

    let toastId: string | number | undefined;
    if (!silent) toastId = toast.loading('Detecting location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=en`
          );
          const data = await response.json();
          
          if (!data.address) {
            throw new Error('No address found');
          }

          const address = data.address;
          const locationName = address.city || address.town || address.village || address.state_district || address.county || 'Tamil Nadu';
          const district = address.state_district || address.county || '';
          
          setDetectedLocation(locationName);
          
          if (!silent) {
            toast.success(`Location detected: ${locationName}`, { id: toastId });
          } else if (user && profile && !profile.location) {
            toast.success(`Welcome! Spotted you in ${locationName}`, {
              description: 'Your location has been updated for better match finding.',
              duration: 5000
            });
          }

          // Auto-update profile if location is missing
          if (user && (!profile?.location || profile?.location === 'Unknown')) {
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
            const { generateGeohash } = await import('../lib/geo');
            
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                location: locationName,
                district: district,
                lat: latitude,
                lng: longitude,
                geohash: generateGeohash({ lat: latitude, lng: longitude }),
                lastLocationUpdate: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
            }
          }
        } catch (error) {
          console.error('Reverse geocoding failed', error);
          if (!silent) toast.error('Could not resolve address name', { id: toastId });
        }
      },
      (error) => {
        console.error('Geolocation error', error);
        if (!silent) {
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Location access denied. Please enable it in browser settings.', { id: toastId });
          } else {
            toast.error('Could not get current position', { id: toastId });
          }
        }
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }, [user, profile]);

  React.useEffect(() => {
    // Only auto-detect if the user just logged in and doesn't have a location set in their profile
    // Or if we haven't detected anything in this session yet
    if (user && profile && !profile.location && !detectedLocation) {
      const timer = setTimeout(() => {
        detectLocation(true);
      }, 2000); // Wait for profile to load and initial render to complete
      return () => clearTimeout(timer);
    }
  }, [user, profile, detectedLocation, detectLocation]);

  const handleLocationClick = () => detectLocation(false);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center animate-bounce">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <p className="text-muted-foreground font-medium animate-pulse">Loading Volley Connect...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-3xl w-full text-center space-y-12"
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3">
              <Trophy className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">
              Volley <span className="text-primary italic">Connect</span>
            </h1>
          </div>

          {/* Value Prop */}
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold opacity-90">
              The Home of Volleyball in Tamil Nadu
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              Find courts near your location, join local tournaments, build your team, and connect with thousands of players across the state.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-card/50 p-6 rounded-2xl border border-border/50 backdrop-blur-sm">
              <MapPin className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-lg mb-2">Find Courts</h3>
              <p className="text-muted-foreground text-sm">Discover indoor, turf, and outdoor courts in your district.</p>
            </div>
            <div className="bg-card/50 p-6 rounded-2xl border border-border/50 backdrop-blur-sm">
              <Trophy className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-lg mb-2">Tournaments</h3>
              <p className="text-muted-foreground text-sm">Stay updated and register for events across the state.</p>
            </div>
            <div className="bg-card/50 p-6 rounded-2xl border border-border/50 backdrop-blur-sm">
              <Users className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-lg mb-2">Connect</h3>
              <p className="text-muted-foreground text-sm">Follow players, form teams, and organize matches easily.</p>
            </div>
          </div>

          {/* Action */}
          <div className="flex flex-col items-center gap-4 pt-8">
            <Button 
              onClick={handleLogin}
              className="px-12 py-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xl font-black rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 uppercase italic tracking-wider"
            >
              Start Playing Now
              <ArrowRight className="w-6 h-6" />
            </Button>
            <p className="text-muted-foreground text-sm font-medium">
              Join 5,000+ players already on the platform
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <OnboardingTour />
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-[260px] bg-card border-r border-border flex-col p-10 fixed h-full">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <span className="text-[17px] font-extrabold text-primary tracking-tighter">
              VOLLEY CONNECT
            </span>
          </div>

        <nav className="flex-1">
          <ul className="space-y-3">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[15px] font-medium transition-all ${
                    location.pathname === item.path
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-10">
          {user ? (
            <div className="bg-muted rounded-lg p-4 border border-border/50">
              <p className="text-[12px] font-bold mb-2 uppercase tracking-wider text-muted-foreground">Logged In As</p>
              <div className="flex items-center gap-3">
                <img
                  src={profile?.photoURL || user.photoURL || undefined}
                  alt={user.displayName || ''}
                  className="w-10 h-10 rounded-full border border-border"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden">
                  <p className="text-[14px] font-bold text-foreground truncate">{profile?.displayName}</p>
                  <button 
                    onClick={handleLocationClick}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer group/loc"
                  >
                    <MapPin className="w-3 h-3 group-hover/loc:scale-110 transition-transform" />
                    <span className="truncate">{detectedLocation || profile?.location || 'Tamil Nadu'}</span>
                  </button>
                  <button onClick={handleLogout} className="text-[12px] text-primary font-semibold hover:underline mt-1 block">
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={handleLogin} className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-lg">
              Sign In
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile Nav Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4 text-foreground">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="text-md font-extrabold text-primary tracking-tighter">
            VOLLEY CONNECT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          {user && (
            <div className="flex items-center gap-2 mr-1">
              <button onClick={handleLocationClick} className="text-right">
                <div className="flex items-center justify-end gap-0.5 text-foreground leading-none">
                  <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
                  <p className="font-bold text-[10px] truncate max-w-[80px]">{detectedLocation || profile?.location || 'TN'}</p>
                </div>
              </button>
              <Link to="/profile" className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center font-bold text-background shadow-sm border border-foreground/5 overflow-hidden shrink-0">
                {profile?.photoURL ? (
                  <img src={profile.photoURL || undefined} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[10px]">{profile?.displayName?.substring(0, 2).toUpperCase()}</span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card p-6 pb-12 rounded-t-[2.5rem] border-t border-border shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-[13px] font-bold transition-all border ${
                        isActive 
                          ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' 
                          : 'text-foreground bg-muted/30 border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="space-y-3">
                {user ? (
                  <button 
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }} 
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[15px] font-bold text-red-500 bg-red-50 transition-all border border-red-100 active:scale-95"
                  >
                    <LogOut className="w-5 h-5 transition-transform" />
                    Sign Out
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      handleLogin();
                      setIsMobileMenuOpen(false);
                    }} 
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[15px] font-bold text-primary bg-primary/10 transition-all border border-primary/10 active:scale-95"
                  >
                    <Zap className="w-5 h-5 animate-pulse" />
                    Sign In
                  </button>
                )}
                
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-4 text-muted-foreground font-black uppercase tracking-widest text-[10px] hover:text-primary transition-colors"
                >
                  Close Menu
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50 flex items-center justify-around px-2 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
        {navItems.filter(item => ['Dashboard', 'Tournaments', 'Nearby Courts', 'Connections', 'Profile'].includes(item.name)).map((item) => {
          const isActive = location.pathname === item.path && !searchParams.get('uid');
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 relative ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {isActive && (
                <motion.div 
                   layoutId="activeTabMobile"
                   className="absolute top-0 w-8 h-1 bg-primary rounded-full"
                   initial={false}
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon 
                className={`transition-all duration-300 ${
                  isActive ? 'w-6 h-6 stroke-[2.5px] scale-110' : 'w-5 h-5 stroke-[1.5px]'
                }`} 
              />
              <span className={`text-center truncate w-full transition-all duration-300 uppercase tracking-tighter ${
                isActive ? 'text-[11px] font-black' : 'text-[10px] font-bold'
              }`}>
                {item.name === 'Nearby Courts' ? 'Courts' : item.name}
              </span>
            </Link>
          );
        })}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground relative"
        >
          <Menu className="w-5 h-5 stroke-[1.5px]" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">More</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[260px] p-4 lg:p-10 pt-20 lg:pt-10 pb-20 lg:pb-10">
        <header className="hidden lg:flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-muted-foreground text-[14px] font-medium">Welcome back,</p>
            <h1 className="text-[32px] font-bold tracking-tight text-foreground">
              {user ? profile?.displayName : 'Guest Player'}
            </h1>
          </div>
          {user && (
            <div className="flex items-center gap-3 md:gap-4 ml-auto sm:ml-0">
              <NotificationCenter />
              <button onClick={handleLocationClick} className="text-right group/loc">
                <div className="flex items-center justify-end gap-1 text-foreground">
                  <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary shrink-0 group-hover/loc:scale-110 transition-transform" />
                  <p className="font-bold text-[13px] md:text-[15px]">{detectedLocation || profile?.location || 'Tamil Nadu'}</p>
                </div>
                <p className="text-[10px] md:text-[12px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                  {profile?.role} • {profile?.skillLevel || 'Level 1'}
                </p>
              </button>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-foreground rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-background shadow-lg shadow-foreground/10 border border-foreground/5 overflow-hidden shrink-0">
                {profile?.photoURL ? (
                  <img src={profile.photoURL || undefined} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile?.displayName?.substring(0, 2).toUpperCase()
                )}
              </div>
            </div>
          )}
        </header>

        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
