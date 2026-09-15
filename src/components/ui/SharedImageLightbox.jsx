import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

// The same layoutId is used by the thumbnail and full-size image so Framer
// Motion expands the image in place instead of navigating to its source URL.
export default function SharedImageLightbox({ image, layoutId, alt = '', onClose }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {image && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute end-5 top-5 z-10 rounded-full bg-black/45 p-2 text-white shadow-lg transition hover:bg-black/70"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          <motion.img
            layoutId={layoutId}
            src={image}
            alt={alt}
            onClick={event => event.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
