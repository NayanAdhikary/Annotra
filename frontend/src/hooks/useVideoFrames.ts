import { useState, useEffect } from 'react';

export const useVideoFrames = (taskId: number) => {
  const [frames, setFrames] = useState<string[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/frames`)
      .then((r) => r.json())
      .then((data) => setFrames(data.frames)).catch(console.error);
  }, [taskId]);

  return { frames, currentFrame, setCurrentFrame };
};