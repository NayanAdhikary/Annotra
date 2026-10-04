import React, { useEffect, useRef, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { ImageAsset } from '../../api/images';

interface Props {
  images: ImageAsset[];
  onOpen: (img: ImageAsset) => void;
  onDelete?: (img: ImageAsset) => void;
}

export const ImageGrid: React.FC<Props> = ({ images, onOpen, onDelete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const cols = Math.max(1, Math.floor(containerWidth / 120));
  const rows = Math.ceil(images.length / cols);

  return (
    <div ref={containerRef} className="border rounded flex-1 min-h-0 w-full p-2 h-[500px]">
      {containerWidth > 0 && images.length > 0 && (
        <Grid
          columnCount={cols}
          rowCount={rows}
          columnWidth={containerWidth / cols - 8}
          rowHeight={130}
          width={containerWidth - 16}
          height={480}
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * cols + columnIndex;
            const img = images[index];
            if (!img) return null;
            return (
              <div style={style} className="p-1">
                <div className="relative group w-full h-full">
                  <button
                    onClick={() => onOpen(img)}
                    className="w-full h-full rounded overflow-hidden bg-slate-100 relative border border-slate-200 hover:border-indigo-400 block"
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
              </div>
            );
          }}
        </Grid>
      )}
    </div>
  );
};
