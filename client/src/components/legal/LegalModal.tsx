import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PrivacyContent from "./PrivacyContent";
import TermsContent from "./TermsContent";

interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "privacy" | "terms";
}

/**
 * LegalModal — branded shadcn Dialog wrapping shared Privacy/Terms content.
 *
 * Mounted into LandingPage and login.tsx. Opened by left-clicking the
 * footer Privacy/Terms anchors (which preserve their href so middle-click
 * new-tab still navigates to the standalone /legal/privacy or /legal/terms
 * deep-link page).
 *
 * Radix Dialog (underlying shadcn primitive) provides for free:
 *   - focus-trap while open + focus-restore on close
 *   - Escape-to-close
 *   - aria-labelledby / aria-describedby tied to DialogTitle + DialogDescription
 *   - click-outside-to-close (overlay)
 *   - native DialogClose X button (keyboard + mouse accessible)
 *
 * Do NOT add a manual focus-trap. Do NOT remove the native Close button.
 */
export default function LegalModal({
  open,
  onOpenChange,
  type,
}: LegalModalProps) {
  const title = type === "privacy" ? "Privacy Policy" : "Terms of Service";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Force light-mode rendering on the modal regardless of host page theme.
        Without this, the modal inherits the dark landing/login background and
        body text washes out to barely-visible gray. Light card against dark
        overlay reads sharply on every host.

        Inner sections (Header, scrollable body) and the close button get
        explicit slate text classes so they don't fall back to theme-foreground
        tokens that won't exist on a forced bg-white surface.
      */}
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 bg-white text-slate-900 border-slate-200 [&>button]:text-slate-500 [&>button]:hover:text-slate-700">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-amber-700">
            DRAFT — for legal review · Last updated 2026-05-04
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-4 text-slate-700">
          {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
