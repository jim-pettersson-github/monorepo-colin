export function SportIcon({ kind }: { kind: 'run' | 'hurdles' | 'jump' | 'throw' | 'archery' | 'diving' | 'weightlifting' | 'star' | 'sound' | 'mute' }) {
  return (
    <svg viewBox='0 0 48 48' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      {kind === 'archery' ? (
        <>
          <circle cx='23' cy='25' r='17' />
          <circle cx='23' cy='25' r='10' />
          <circle cx='23' cy='25' r='3' />
          <path d='m23 25 19-20m-7 0h7v7' />
        </>
      ) : kind === 'diving' ? (
        <>
          <path d='M5 38q5-5 10 0t10 0t10 0t10 0M5 45q5-5 10 0t10 0t10 0t10 0M3 18h14m-5 0v14M22 14l8 7 8 2M30 21l-6 8 8 5M22 14l-4-8m4 8 8-7' />
          <circle cx='36' cy='9' r='4' />
        </>
      ) : kind === 'weightlifting' ? (
        <>
          <path d='M4 17h40M7 10v14m5-17v20m24-20v20m5-17v14M24 22v12m0 0-10 9m10-9 10 9M15 17l3 11h12l3-11' />
          <circle cx='24' cy='11' r='4' />
        </>
      ) : kind === 'star' ? (
        <path d='m24 5 6 12 13 2-10 9 3 14-12-7-12 7 3-14-10-9 13-2Z' />
      ) : kind === 'sound' || kind === 'mute' ? (
        <>
          <path d='M8 19h8l11-9v28l-11-9H8Z' />
          {kind === 'sound' ? <path d='M34 16q10 8 0 16m5-22q17 14 0 28' /> : <path d='m34 18 10 12m0-12L34 30' />}
        </>
      ) : (
        <>
          <circle cx='28' cy='9' r='4' />
          <path d='m24 18 9 7 8-3m-17-4-7 12-9 5m9-5 12 4 5 10m-14-6-8 8M24 18l-8-3-9 5' />
          {kind === 'hurdles' ? (
            <path d='M33 34h12m-10 0v10m8-10v10' />
          ) : kind === 'jump' ? (
            <path d='M3 44h24m10-4 4-2m-10 0 4-2' />
          ) : kind === 'throw' ? (
            <path d='m35 10 10-7m-7 0h7v7' />
          ) : null}
        </>
      )}
    </svg>
  );
}
export function Key({ children }: { children: React.ReactNode }) {
  return <kbd>{children}</kbd>;
}
export function PadFace({ index }: { index: number }) {
  const positions = [
    [18, 29],
    [30, 18],
    [6, 18],
    [18, 6],
  ];
  if (index > 3) return <kbd>#{index}</kbd>;
  return (
    <svg viewBox='0 0 36 36' className='pad-face' role='img' aria-label={`${['Nedersta', 'Högra', 'Vänstra', 'Översta'][index]} handkontrollknappen`}>
      <title>Handkontrollknapp</title>
      {positions.map(([x, y], i) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r='5' fill={i === index ? 'currentColor' : 'none'} stroke='currentColor' opacity={i === index ? 1 : 0.25} />
      ))}
    </svg>
  );
}
