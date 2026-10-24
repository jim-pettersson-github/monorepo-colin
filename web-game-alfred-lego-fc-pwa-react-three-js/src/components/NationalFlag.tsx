import type { ClubId } from '../game/clubs';
import { nations } from '../game/nations';

const star = 'M0-9 2.7-3 9-3 4 1 5.5 7.5 0 4-5.5 7.5-4 1-9-3-2.7-3Z';
export function NationalFlag({ id }: { id: ClubId }) {
  if (!nations.some((nation) => nation.id === id)) return null;
  const stripes = (colors: string[], vertical = false) =>
    colors.map((color, i) => {
      const position = i / colors.length;
      return (
        <rect
          key={position}
          x={vertical ? (i * 60) / colors.length : 0}
          y={vertical ? 0 : (i * 40) / colors.length}
          width={vertical ? 60 / colors.length : 60}
          height={vertical ? 40 : 40 / colors.length}
          fill={color}
        />
      );
    });
  const nordicColors: Partial<Record<ClubId, string[]>> = {
    swe: ['#1663a5', '#ffdb3a'],
    den: ['#d72e45', '#fff'],
    nor: ['#cb2c41', '#fff', '#193664'],
    fin: ['#fff', '#22549d'],
    isl: ['#2866af', '#fff', '#d72e45'],
  };
  const nordic = nordicColors[id];
  const verticalColors: Partial<Record<ClubId, string[]>> = {
    fra: ['#244b94', '#fff', '#d93042'],
    ita: ['#239663', '#fff', '#d93042'],
    bel: ['#23262b', '#f3d13c', '#d93042'],
    mex: ['#23875b', '#fff', '#c93348'],
  };
  const tricolor = verticalColors[id];
  const horizontalColors: Partial<Record<ClubId, string[]>> = {
    ger: ['#24262a', '#d93042', '#f3cd36'],
    ned: ['#c53140', '#fff', '#2756a1'],
    arg: ['#81c7e7', '#fff', '#81c7e7'],
    irn: ['#288a59', '#fff', '#d93042'],
  };
  const horizontal = horizontalColors[id];
  return (
    <svg className='national-flag' viewBox='0 0 60 40' aria-hidden='true'>
      <rect width='60' height='40' fill='#fff' />
      {nordic && (
        <>
          <rect width='60' height='40' fill={nordic[0]} />
          <path d='M20 0v40M0 20h60' stroke={nordic[1]} strokeWidth={nordic[2] ? 10 : 7} />
          {nordic[2] && <path d='M20 0v40M0 20h60' stroke={nordic[2]} strokeWidth='5' />}
        </>
      )}
      {tricolor && stripes(tricolor, true)}
      {horizontal && stripes(horizontal)}
      {id === 'arg' && <circle cx='30' cy='20' r='4' fill='#e5b638' />}
      {id === 'irn' && <path d='M26 24l4-8 4 8m-4-9v10' fill='none' stroke='#cf3040' strokeWidth='2' />}
      {id === 'eng' && <path d='M30 0v40M0 20h60' stroke='#cc3041' strokeWidth='7' />}
      {id === 'esp' && stripes(['#c52b3c', '#f2ca38', '#f2ca38', '#c52b3c'])}
      {id === 'por' && (
        <>
          <rect width='24' height='40' fill='#267d4c' />
          <rect x='24' width='36' height='40' fill='#c62b3e' />
          <circle cx='24' cy='20' r='7' fill='#f2ce3c' />
          <path d='M20 15h8v8l-4 4-4-4Z' fill='#fff' stroke='#b52d3b' strokeWidth='2' />
        </>
      )}
      {id === 'bra' && (
        <>
          <rect width='60' height='40' fill='#27995a' />
          <path d='M5 20 30 3 55 20 30 37Z' fill='#f6d743' />
          <circle cx='30' cy='20' r='10' fill='#2555a3' />
          <path d='M21 17q11-1 18 8' fill='none' stroke='#fff' strokeWidth='2' />
        </>
      )}
      {id === 'col' && <>{stripes(['#f4ce34', '#f4ce34', '#244f9d', '#c52c40'])}</>}
      {id === 'jpn' && <circle cx='30' cy='20' r='10' fill='#c5304b' />}
      {id === 'sui' && (
        <>
          <rect width='60' height='40' fill='#d62e42' />
          <path d='M30 8v24M18 20h24' stroke='#fff' strokeWidth='7' />
        </>
      )}
      {id === 'mar' && (
        <>
          <rect width='60' height='40' fill='#c52d40' />
          <path d='m30 8 7 22-18-14h22L23 30Z' fill='none' stroke='#25834b' strokeWidth='2' />
        </>
      )}
      {id === 'uru' && (
        <>
          {stripes(['#fff', '#68b5df', '#fff', '#68b5df', '#fff', '#68b5df', '#fff', '#68b5df', '#fff'])}
          <rect width='23' height='22' fill='#fff' />
          <circle cx='11' cy='11' r='6' fill='#e7b739' />
        </>
      )}
      {id === 'usa' && (
        <>
          {stripes(Array.from({ length: 13 }, (_, i) => (i % 2 ? '#fff' : '#c43348')))}
          <rect width='28' height='22' fill='#284377' />
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2, 3].map((col) => <path key={`${row}-${col}`} d={star} transform={`translate(${4 + col * 6.5} ${4 + row * 7}) scale(.22)`} fill='#fff' />),
          )}
        </>
      )}
      {id === 'cro' && (
        <>
          {stripes(['#d63845', '#fff', '#2356a4'])}
          <path d='M23 11h14v15l-7 6-7-6Z' fill='#fff' stroke='#2356a4' />
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2].map((col) =>
              (row + col) % 2 ? null : <rect key={`${row}-${col}`} x={24 + col * 4} y={12 + row * 5} width='4' height='5' fill='#d63845' />,
            ),
          )}
        </>
      )}
      {id === 'mex' && <circle cx='30' cy='22' r='4' fill='#94743e' />}
    </svg>
  );
}
