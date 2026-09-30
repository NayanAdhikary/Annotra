/**
 * COCO-style RLE. Encodes a binary mask (Uint8Array of h*w) into an
 * array of run lengths, starting with the count of zeros.
 */
export interface RLE {
  counts: number[];
  size: [number, number];  // [height, width]
}

export function encodeRLE(mask: Uint8Array, width: number, height: number): RLE {
  const counts: number[] = [];
  let current = 0;
  let run = 0;
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i] ? 1 : 0;
    if (v === current) {
      run++;
    } else {
      counts.push(run);
      current = v;
      run = 1;
    }
  }
  counts.push(run);
  return { counts, size: [height, width] };
}

export function decodeRLE(rle: RLE): Uint8Array {
  const [h, w] = rle.size;
  const out = new Uint8Array(h * w);
  let idx = 0;
  let value = 0;
  for (const run of rle.counts) {
    if (value) out.fill(1, idx, idx + run);
    idx += run;
    value = 1 - value;
  }
  return out;
}