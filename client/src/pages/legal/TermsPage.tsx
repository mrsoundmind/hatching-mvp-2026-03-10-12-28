import LegalPageLayout from "@/components/legal/LegalPageLayout";
import TermsContent from "@/components/legal/TermsContent";

/**
 * Standalone /legal/terms route — deep-link fallback half of the hybrid
 * legal-content render. Used when a user navigates directly (URL bar,
 * middle-click new-tab, crawler, external partner link).
 */
export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="2026-05-04">
      <TermsContent />
    </LegalPageLayout>
  );
}
