import React from 'react';
// @ts-ignore
import { FixedSizeGrid as Grid } from 'react-window';
import type { ImageAsset } from '../../api/images';

interface Props {
  images: ImageAsset[];
  onOpen: (img: ImageAsset) => void;
}

const COLUMN_WIDTH = 120;
const ROW_HEIGHT = 130;

export const ImageGrid: React.FC<Props> = ({ images, onOpen }) => {
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(1, Math.floor(size.w / COLUMN_WIDTH));
  const rows = Math.ceil(images.length / cols);

  return (
    <div ref={ref} className="border rounded overflow-hidden flex-1 min-h-0 w-full" style={{ minHeight: 400 }}>
      {size.w > 0 && (
        <Grid
          columnCount={cols}
          rowCount={rows}
          columnWidth={COLUMN_WIDTH}
          rowHeight={ROW_HEIGHT}
          width={size.w}
          height={size.h || 400}
        >
          {({ columnIndex, rowIndex, style }: any) => {
            const i = rowIndex * cols + columnIndex;
            const img = images[i];
            if (!img) return null;
            return (
              <div style={style} className="p-1">
                <button
                  onClick={() => onOpen(img)}
                  className="w-full h-full rounded overflow-hidden bg-slate-100 relative group"
                >
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            );
          }}
        </Grid>
      )}
    </div>
  );
};
