import { useRef, useState } from 'react';
import { ImageOff, Lightbulb, Maximize2, X } from 'lucide-react';
import type { ContentImage } from '../types/content.ts';

/** Lightbox con <dialog> nativo: foco atrapado, Esc para cerrar y fondo inerte sin código extra. */
export function ImageLightbox({ image, dialogRef }: { image: ContentImage; dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label={`Imagen ampliada: ${image.alt}`}
      onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
    >
      <button className="icon-btn lightbox__close" onClick={() => dialogRef.current?.close()} aria-label="Cerrar imagen" autoFocus>
        <X aria-hidden />
      </button>
      <img src={image.src} alt={image.alt} />
      {image.description && <p className="lightbox__caption">{image.description}</p>}
    </dialog>
  );
}

export function ImageFigure({ image, showGuide = true }: { image: ContentImage; showGuide?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  return (
    <figure className="figure">
      {failed ? (
        <div className="figure__missing" role="img" aria-label={image.alt}>
          <ImageOff aria-hidden />
          <span>Imagen no disponible</span>
        </div>
      ) : (
        <button className="figure__zoom" onClick={() => dialogRef.current?.showModal()} aria-label={`Ampliar imagen: ${image.alt}`}>
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            width={image.width}
            height={image.height}
            onError={() => setFailed(true)}
          />
          <span className="figure__zoom-hint" aria-hidden><Maximize2 size={16} /></span>
        </button>
      )}
      <figcaption>
        {image.description ?? image.alt}
        {image.page > 0 && <span className="figure__page"> · Lámina {image.page}</span>}
      </figcaption>
      {showGuide && image.labels.length > 0 && (
        <aside className="observe">
          <p className="observe__title"><Lightbulb size={18} aria-hidden /> ¿Qué debes observar?</p>
          <p>Ubica en la imagen estos elementos:</p>
          <ul className="chips">{image.labels.map((l) => <li key={l}>{l}</li>)}</ul>
        </aside>
      )}
      {!failed && <ImageLightbox image={image} dialogRef={dialogRef} />}
    </figure>
  );
}
