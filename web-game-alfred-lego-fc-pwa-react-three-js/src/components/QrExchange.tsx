import QrScanner from 'qr-scanner';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

export function QrExchange({ code, role, onCode }: { code: string; role: 'host' | 'guest'; onCode: (value: string) => Promise<void> }) {
  const [image, setImage] = useState('');
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const reading = useRef(false);
  const read = useRef(onCode);
  read.current = onCode;
  const accept = async (value: string) => {
    if (reading.current) return;
    reading.current = true;
    setBusy(true);
    setError('');
    try {
      await read.current(value);
      setText('');
      setNotice('Koden är inläst.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Koden kunde inte läsas. Försök igen.');
    } finally {
      reading.current = false;
      setBusy(false);
    }
  };
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  useEffect(() => {
    let active = true;
    setImage('');
    if (code)
      QRCode.toDataURL(code, { width: 512, margin: 4, errorCorrectionLevel: 'L' })
        .then((url) => {
          if (active) setImage(url);
        })
        .catch(() => {
          if (active) setError('Koden är för stor för en QR-bild. Använd kopiera och klistra in.');
        });
    return () => {
      active = false;
    };
  }, [code]);
  useEffect(() => {
    if (!scanning || !video.current) return;
    let active = true;
    const scanner = new QrScanner(
      video.current,
      (result) => {
        scanner.stop();
        setScanning(false);
        void acceptRef.current(result.data);
      },
      {
        preferredCamera: 'environment',
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
        onDecodeError: () => {},
        calculateScanRegion: (element) => {
          const width = element.videoWidth || 768;
          const height = element.videoHeight || 768;
          const scale = Math.min(1, 768 / Math.max(width, height));
          return { x: 0, y: 0, width, height, downScaledWidth: Math.round(width * scale), downScaledHeight: Math.round(height * scale) };
        },
      },
    );
    scanner.start().catch(() => {
      if (!active) return;
      setScanning(false);
      setError('Kameran kunde inte öppnas. Tillåt kamera i webbläsaren, välj en QR-bild eller klistra in koden. Kamera kräver HTTPS eller localhost.');
    });
    return () => {
      active = false;
      scanner.destroy();
    };
  }, [scanning]);
  return (
    <section className='qr-exchange' aria-label='QR-koppling'>
      {code && (
        <div className='qr-output'>
          <h2>{role === 'host' ? '1. Visa din matchkod' : '2. Visa din svarskod'}</h2>
          <p>{role === 'host' ? 'Kompisen väljer Anslut och skannar bilden.' : 'Låt värden skanna den här bilden för att slutföra kopplingen.'}</p>
          {image && <img className='connection-qr' src={image} alt={role === 'host' ? 'QR-kod för matchen' : 'QR-kod med svar till värden'} />}
          <details>
            <summary>Kopiera kod istället</summary>
            <label>
              {role === 'host' ? 'Din matchkod' : 'Din svarskod'}
              <textarea readOnly value={code} onFocus={(event) => event.target.select()} />
            </label>
            <button
              type='button'
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setNotice('Koden är kopierad.');
                } catch {
                  setNotice('Markera och kopiera koden i textfältet.');
                }
              }}
            >
              Kopiera koden
            </button>
          </details>
        </div>
      )}
      {(role === 'host' || !code) && (
        <div className='qr-input'>
          <h2>{role === 'host' ? '3. Läs kompisens svar' : '1. Läs värdens matchkod'}</h2>
          <div className='qr-input-actions'>
            <button
              type='button'
              disabled={busy}
              onClick={() => {
                setError('');
                setScanning(!scanning);
              }}
            >
              {scanning ? 'Stäng kameran' : 'Skanna med kameran'}
            </button>
            <label className='qr-file-button'>
              Välj QR-bild
              <input
                type='file'
                accept='image/*'
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setError('');
                  setScanning(false);
                  try {
                    const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true, alsoTryWithoutScanRegion: true });
                    await accept(result.data);
                  } catch {
                    setError('Ingen QR-kod hittades i bilden. Prova en tydligare bild eller klistra in koden.');
                  }
                }}
              />
            </label>
          </div>
          <video ref={video} hidden={!scanning} muted playsInline aria-label='Kamera för QR-kod' />
          <details>
            <summary>Klistra in kod istället</summary>
            <label>
              Klistra in anslutningskod
              <textarea value={text} maxLength={6000} spellCheck={false} onChange={(event) => setText(event.target.value)} />
            </label>
            <button type='button' disabled={busy || !text.trim()} onClick={() => void accept(text)}>
              {busy ? 'Läser koden…' : 'Läs in koden'}
            </button>
          </details>
        </div>
      )}
      {error && (
        <p className='control-warning' role='alert'>
          {error}
        </p>
      )}
      {notice && (
        <p className='small-copy' role='status'>
          {notice}
        </p>
      )}
    </section>
  );
}
