import QrScanner from 'qr-scanner';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

// Shows this device's code as a QR image, with share and copy for phones that cannot scan each other.
export function CodeShow({ code, label, alt }: { code: string; label: string; alt: string }) {
  const [image, setImage] = useState('');
  const [notice, setNotice] = useState('');
  const canShare = typeof navigator.share === 'function';
  useEffect(() => {
    let active = true;
    setImage('');
    if (code)
      QRCode.toDataURL(code, { width: 512, margin: 3, errorCorrectionLevel: 'L' })
        .then((url) => {
          if (active) setImage(url);
        })
        .catch(() => {
          if (active) setNotice('Koden är för stor för en QR-bild. Dela eller kopiera den istället.');
        });
    return () => {
      active = false;
    };
  }, [code]);
  if (!code) return <p role='status'>Skapar koden…</p>;
  return (
    <div className='code-show'>
      {image && <img className='connection-qr' src={image} alt={alt} />}
      <div className='code-actions'>
        {canShare && (
          <button
            type='button'
            className='primary'
            onClick={async () => {
              try {
                await navigator.share({ title: 'Charlie for Speed', text: code });
                setNotice('Koden är delad.');
              } catch {
                // Closing the share sheet is not an error.
              }
            }}
          >
            Dela koden
          </button>
        )}
        <button
          type='button'
          className={canShare ? undefined : 'primary'}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setNotice('Koden är kopierad. Klistra in den i ett meddelande.');
            } catch {
              setNotice('Markera och kopiera koden nedan.');
            }
          }}
        >
          Kopiera koden
        </button>
      </div>
      <details className='code-details'>
        <summary>Visa koden som text</summary>
        <label>
          {label}
          <textarea className='code-text' readOnly value={code} rows={3} onFocus={(event) => event.target.select()} />
        </label>
      </details>
      {notice && <p role='status'>{notice}</p>}
    </div>
  );
}

// Reads the other device's code from the camera, a pasted message or a saved QR image.
export function CodeRead({ onCode, placeholder }: { onCode: (value: string) => Promise<void>; placeholder: string }) {
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const reading = useRef(false);
  const read = useRef(onCode);
  read.current = onCode;
  const canPaste = typeof navigator.clipboard?.readText === 'function';
  const accept = async (value: string) => {
    if (reading.current) return;
    reading.current = true;
    setBusy(true);
    setError('');
    try {
      await read.current(value);
      setText('');
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
      setError('Kameran kunde inte öppnas. Klistra in koden istället, eller tillåt kameran i webbläsaren.');
    });
    return () => {
      active = false;
      scanner.destroy();
    };
  }, [scanning]);
  return (
    <div className='code-read'>
      <div className='code-actions'>
        <button
          type='button'
          className='primary'
          disabled={busy}
          onClick={() => {
            setError('');
            setScanning(!scanning);
          }}
        >
          {scanning ? 'Stäng kameran' : 'Skanna med kameran'}
        </button>
        {canPaste && (
          <button
            type='button'
            disabled={busy}
            onClick={async () => {
              try {
                const pasted = await navigator.clipboard.readText();
                setText(pasted);
                if (pasted.trim()) await accept(pasted);
              } catch {
                setError('Kunde inte läsa urklipp. Håll fingret i rutan nedan och välj Klistra in.');
              }
            }}
          >
            Klistra in
          </button>
        )}
      </div>
      <video ref={video} hidden={!scanning} muted playsInline aria-label='Kamera för QR-kod' />
      <label>
        Klistra in anslutningskod
        <textarea
          className='code-text'
          value={text}
          rows={2}
          maxLength={6000}
          spellCheck={false}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className='code-actions'>
        <button type='button' disabled={busy || !text.trim()} onClick={() => void accept(text)}>
          {busy ? 'Läser koden…' : 'Läs in koden'}
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
      {error && <p role='alert'>{error}</p>}
    </div>
  );
}

// The host's two steps for one invitation: show the match code, then read the reply.
export function InviteSteps({ code, onAnswer, player }: { code: string; onAnswer: (value: string) => Promise<void>; player: number }) {
  return (
    <div className='invite-steps'>
      <section className='wifi-step'>
        <h3>
          <span className='step-number'>1</span> Visa koden för spelare {player}
        </h3>
        <p>Kompisen väljer Jag går med och skannar bilden. Funkar inte kameran? Dela koden via SMS eller chatt.</p>
        <CodeShow code={code} label='Din matchkod' alt='QR-kod för matchen' />
      </section>
      <section className='wifi-step'>
        <h3>
          <span className='step-number'>2</span> Läs in kompisens svar
        </h3>
        <p>Kompisens telefon visar en svarskod. Skanna den, eller klistra in den om du fick den i ett meddelande.</p>
        <CodeRead onCode={onAnswer} placeholder='Klistra in kompisens svarskod här' />
      </section>
    </div>
  );
}
