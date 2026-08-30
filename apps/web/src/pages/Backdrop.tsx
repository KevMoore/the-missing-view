/**
 * The big screen's painted backdrop. The server names one scene per beat of the
 * flow (lobby, each act, the commitment, the accusation, the reveal); this only
 * cross-fades to whatever it is handed, so adding art is a case-pack edit.
 */
import { useEffect, useState } from 'react';

const FADE_MS = 1600;

export function Backdrop({ src }: { src: string | undefined }) {
  const [shown, setShown] = useState<string | undefined>(src);
  const [outgoing, setOutgoing] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (src === shown) return;
    setOutgoing(shown);
    setShown(src);
    const t = setTimeout(() => {
      setOutgoing(undefined);
    }, FADE_MS);
    return () => {
      clearTimeout(t);
    };
  }, [src, shown]);

  return (
    <div className="backdrop" aria-hidden="true">
      {outgoing !== undefined && (
        <div className="backdrop-layer" style={{ backgroundImage: `url(${outgoing})` }} />
      )}
      {shown !== undefined && (
        <div
          key={shown}
          className="backdrop-layer backdrop-in"
          style={{ backgroundImage: `url(${shown})` }}
        />
      )}
      <div className="backdrop-scrim" />
    </div>
  );
}
