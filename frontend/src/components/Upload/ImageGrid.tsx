import React from 'react';
import type { ImageAsset } from '../../api/images';

interface Props {
  images: ImageAsset[];
  onOpen: (img: ImageAsset) => void;
}

export const ImageGrid: React.FC<Props> = ({ images, onOpen }) => {
  return (
    <div className="border rounded overflow-y-auto flex-1 min-h-0 w-full p-2" style={{ maxHeight: 600 }}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
        {images.map((img) => (
          <button
            key={img.id}
            onClick={() => onOpen(img)}
            className="w-full h-32 rounded overflow-hidden bg-slate-100 relative group border border-slate-200 hover:border-indigo-400"
          >
            <img
              src={img.url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
