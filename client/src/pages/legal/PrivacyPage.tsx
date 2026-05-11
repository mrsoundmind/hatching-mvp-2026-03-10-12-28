import LegalPageLayout from "@/components/legal/LegalPageLayout";
import PrivacyContent from "@/components/legal/PrivacyContent";

/**
 * Standalone /legal/privacy route — deep-link fallback half of the hybrid
 * legal-content render. Used when a user navigates directly (URL bar,
 * middle-click new-tab, crawler, external partner link).
 */
export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="2026-05-04">
      <PrivacyContent />
    </LegalPageLayout>
  );
}
