import { useEffect, useRef, useState } from 'react';
import { createPitchPreview } from '../game/pitch-preview';

export function PitchPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      return createPitchPreview(canvas);
    } catch {
      setUnavailable(true);
    }
  }, []);

  return (
    <div className='pitch-preview' role='img' aria-label='En fotbollsplan i 3D med grönt gräs, vita linjer och två mål.'>
      <canvas ref={canvasRef} />
      {unavailable && <p className='render-error'>3D-förhandsvisningen behöver en webbläsare med WebGL 2.</p>}
    </div>
  );
}
