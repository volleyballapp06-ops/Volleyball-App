import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui/button';
import { toast } from 'sonner';

export default function SeedData() {
  const seedTournaments = async () => {
    const tournaments = [
      {
        name: "Chennai Open Volleyball Championship",
        location: "Marina Beach Court",
        district: "Chennai",
        startDate: new Date("2026-05-15"),
        endDate: new Date("2026-05-17"),
        description: "Annual open championship for all teams across TN.",
        organizer: "Chennai Volleyball Association",
        status: "upcoming",
        createdAt: serverTimestamp()
      },
      {
        name: "Madurai District League",
        location: "Race Course Stadium",
        district: "Madurai",
        startDate: new Date("2026-06-10"),
        endDate: new Date("2026-06-20"),
        description: "District level league for registered clubs.",
        organizer: "Madurai Sports Club",
        status: "upcoming",
        createdAt: serverTimestamp()
      },
      {
        name: "Coimbatore Smashers Cup",
        location: "PSG Tech Grounds",
        district: "Coimbatore",
        startDate: new Date("2026-04-20"),
        endDate: new Date("2026-04-22"),
        description: "Inter-college and open tournament.",
        organizer: "Coimbatore Smashers",
        status: "ongoing",
        createdAt: serverTimestamp()
      }
    ];

    try {
      for (const t of tournaments) {
        await addDoc(collection(db, 'tournaments'), t);
      }
      toast.success("Tournaments seeded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to seed tournaments");
    }
  };

  const seedCourts = async () => {
    const courts = [
      {
        name: "Marina Beach Volleyball Court",
        location: "Marina Beach, Chennai",
        district: "Chennai",
        createdBy: "system",
        facilities: ["Standard Court", "Beach Sand", "Public Access"],
        imageUrl: "https://images.unsplash.com/photo-1612872086822-4421f172c21c?q=80&w=2070&auto=format&fit=crop",
        rating: 4.8,
        createdAt: serverTimestamp()
      },
      {
        name: "PSG Tech Volleyball Ground",
        location: "Avinashi Road, Coimbatore",
        district: "Coimbatore",
        createdBy: "system",
        facilities: ["Hard Court", "Changing Room", "Parking"],
        imageUrl: "https://images.unsplash.com/photo-1592656670411-2918d7db4b36?q=80&w=2070&auto=format&fit=crop",
        rating: 4.5,
        createdAt: serverTimestamp()
      },
      {
        name: "Trichy Anna Stadium Court",
        location: "Anna Stadium, Trichy",
        district: "Trichy",
        createdBy: "system",
        facilities: ["Indoor", "Professional Net", "Gallery"],
        imageUrl: "https://images.unsplash.com/photo-1544911845-1f34a3eb46b1?q=80&w=2070&auto=format&fit=crop",
        rating: 4.7,
        createdAt: serverTimestamp()
      }
    ];

    try {
      for (const c of courts) {
        await addDoc(collection(db, 'courts'), c);
      }
      toast.success("Courts seeded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to seed courts");
    }
  };

  return (
    <div className="flex flex-wrap gap-4 p-6 bg-[#F8FAFC] rounded-lg border border-border/50">
      <Button onClick={seedTournaments} variant="outline" className="border-border hover:bg-muted font-bold">
        Seed Tournaments
      </Button>
      <Button onClick={seedCourts} variant="outline" className="border-border hover:bg-muted font-bold">
        Seed Courts
      </Button>
    </div>
  );
}
