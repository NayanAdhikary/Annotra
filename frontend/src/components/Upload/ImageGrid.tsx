import React from 'react';
import type { ImageAsset } from '../../api/images';

interface Props {
  images: ImageAsset[];
  onOpen: (img: ImageAsset) => void;
  onDelete?: (img: ImageAsset) => void;
}

export const ImageGrid: React.FC<Props> = ({ images, onOpen, onDelete }) => {
  return (
    <div className="border rounded overflow-y-auto flex-1 min-h-0 w-full p-2" style={{ maxHeight: 600 }}>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative group">
            <button
              onClick={() => onOpen(img)}
              className="w-full h-32 rounded overflow-hidden bg-slate-100 relative border border-slate-200 hover:border-indigo-400 block"
            >
              <img
                src={img.url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(img);
                }}
                className="absolute top-1 right-1 bg-red-600/90 text-white w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                title="Delete image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
