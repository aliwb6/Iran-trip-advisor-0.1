import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// The same layoutId is used by the thumbnail and full-size image so Framer
// Motion expands the image in place instead of navigating to its source URL.
export default function SharedImageLightbox({ image, layoutId, alt = '', onClose }) {
  if (!image) return null;

  // This is a real nested Radix dialog rather than a plain portal. Radix then
  // keeps the parent proposal dialog open while the image dialog is dismissed.
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content
          className="fixed inset-0 z-[101] flex items-center justify-center p-4 outline-none"
          aria-label="Image preview"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{alt || 'Image preview'}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              className="absolute end-5 top-5 z-10 rounded-full bg-black/45 p-2 text-white shadow-lg transition hover:bg-black/70"
              aria-label="Close image preview"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogPrimitive.Close>
          <motion.img
            layoutId={layoutId}
            src={image}
            alt={alt}
            className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
