import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { uploadImage } from '../services/imageService';
import { toast } from 'sonner';

interface ImageUploadProps {
  onImagesChange: (urls: string[]) => void;
  initialImages?: string[];
}

export function ImageUpload({ onImagesChange, initialImages = [] }: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const hasApiKey = !!import.meta.env.VITE_IMGBB_API_KEY;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!hasApiKey) {
      toast.error('Image upload key is missing. Please add VITE_IMGBB_API_KEY to your Secrets in the Settings menu.');
      return;
    }

    setIsUploading(true);
    const newUrls: string[] = [...images];

    try {
      const fileArray = Array.from(files) as File[];
      for (const file of fileArray) {
        // Simple client-side check
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        const url = await uploadImage(file);
        newUrls.push(url);
      }

      setImages(newUrls);
      onImagesChange(newUrls);
      toast.success('Images uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload some images');
      console.error(error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newUrls = images.filter((_, i) => i !== index);
    setImages(newUrls);
    onImagesChange(newUrls);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {images.map((url, index) => (
          <div key={index} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
            <img 
              src={url} 
              alt={`Preview ${index}`} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {isUploading && (
          <div className="w-20 h-20 rounded-lg border border-dashed border-primary/30 flex items-center justify-center bg-primary/5">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-20 h-20 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
        >
          <Upload className="w-5 h-5" />
          <span className="text-[10px] font-medium">Upload</span>
        </button>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />
      
      {images.length === 0 && !isUploading && (
        <div className="text-center py-4 border border-dashed border-border rounded-lg bg-muted/30">
          <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">No images uploaded yet</p>
        </div>
      )}

      {!hasApiKey && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
          <div className="p-1 bg-amber-100 rounded-full text-amber-600 shrink-0">
            <Loader2 className="w-3 h-3 animate-pulse" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-900 leading-none mb-1">Upload Configuration Required</p>
            <p className="text-[10px] text-amber-800 leading-tight">
              To enable image uploads from your device, please add <code className="bg-amber-100 px-1 rounded">VITE_IMGBB_API_KEY</code> to the <span className="font-bold">Secrets</span> section in the <span className="font-bold">Settings</span> menu.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
