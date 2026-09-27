def rle_to_polygon(rle: dict) -> list[float] | None:
    """
    Convert a COCO-style RLE to a polygon outline. Uses a simple marching-squares
    trace. Returns a flat list of x,y coords, or None if the mask is degenerate.
    """
    try:
        from pycocotools import mask as mask_util
    except ImportError:
        return None
    import numpy as np
    from skimage import measure

    h, w = rle["size"]
    counts = rle["counts"]
    # Decode
    mask = np.zeros(h * w, dtype=np.uint8)
    idx = 0
    value = 0
    for run in counts:
        if value:
            mask[idx:idx + run] = 1
        idx += run
        value = 1 - value
    mask = mask.reshape(h, w)

    contours = measure.find_contours(mask, 0.5)
    if not contours:
        return None
    # Take largest contour
    best = max(contours, key=len)
    # skimage returns (y, x); we want [x1, y1, x2, y2, ...]
    pts = []
    for y, x in best:
        pts.extend([float(x), float(y)])
    return pts
