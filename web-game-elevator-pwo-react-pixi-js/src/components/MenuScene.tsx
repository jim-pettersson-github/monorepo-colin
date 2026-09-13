import { useState } from 'react';

import { copy } from '../copy';

export function MenuScene() {
  const [ready, setReady] = useState(false);

  const [failed, setFailed] = useState(false);

  return (
    <div className='scene scene-painted' aria-busy={!ready}>
      {!ready && (
        <p className='scene-loading' role='status'>
          {failed ? 'Bilden kunde inte laddas. Du kan ändå spela.' : copy.loading}
        </p>
      )}
      <img
        src={`${import.meta.env.BASE_URL}art-studies/painted-adventure.webp`}
        alt=''
        width='1254'
        height='1254'
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
