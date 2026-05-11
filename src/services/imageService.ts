/**
 * Service to handle image uploads using ImgBB API.
 * Requires VITE_IMGBB_API_KEY in environment variables.
 */

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

export async function uploadImage(file: File): Promise<string> {
  if (!IMGBB_API_KEY) {
    throw new Error('ImgBB API Key is not configured. Please add VITE_IMGBB_API_KEY to your environment variables.');
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return data.data.url;
    } else {
      throw new Error(data.error?.message || 'Upload failed');
    }
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image. Please check your connection and try again.');
  }
}
