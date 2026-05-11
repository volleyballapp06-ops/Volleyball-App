import { geohashForLocation, distanceBetween } from 'geofire-common';

export interface LocationData {
  lat: number;
  lng: number;
}

export function generateGeohash(location: LocationData): string {
  return geohashForLocation([location.lat, location.lng]);
}

export function calculateDistance(loc1: LocationData, loc2: LocationData): number {
  return distanceBetween([loc1.lat, loc2.lng], [loc2.lat, loc2.lng]);
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

export async function getCurrentPosition(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
}
