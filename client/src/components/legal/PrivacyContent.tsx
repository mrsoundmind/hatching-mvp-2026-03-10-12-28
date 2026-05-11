/**
 * PrivacyContent — pure JSX content for the Privacy Policy. Renders ONLY the
 * body sections (h2 + p + ul) with no outer chrome. Imported by both:
 *   - LegalModal (type="privacy")  — modal default UX
 *   - PrivacyPage                  — /legal/privacy deep-link fallback
 *
 * The DRAFT marker, title, and last-updated date are rendered by the parent
 * (DialogHeader in the modal; LegalPageLayout on the page). Keep this file
 * single-purpose: content only.
 *
 * Tailwind classes are applied per-element so the content reads correctly
 * without requiring the @tailwindcss/typography plugin.
 */
export default function PrivacyContent() {
  return (
    <div className="text-slate-800 text-base leading-relaxed">
      <p className="mt-2 text-slate-600">
        This policy explains what data Hatchin collects, how we use it, and
        which third-party processors we share it with. Hatchin is operated by
        the Hatchin team — for questions about this policy, email{" "}
        <a
          href="mailto:hello@hatchin.ai"
          className="text-indigo-600 hover:text-indigo-800 underline"
        >
          hello@hatchin.ai
        </a>
        .
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Information We Collect
      </h2>
      <p className="mt-3">
        When you sign in to Hatchin with Google, we receive your email address,
        name, profile picture, and a stable identifier (the Google "sub" claim)
        from Google OAuth. We do not request access to your Google Drive, Gmail,
        Calendar, or any other Google service — only the basic profile and
        email scopes.
      </p>
      <p className="mt-3">
        While you use Hatchin, we collect and store:
      </p>
      <ul className="mt-3 list-disc list-inside space-y-1">
        <li>
          Project, team, and agent ("Hatch") configurations you create
        </li>
        <li>
          Messages you send in chat (both to AI teammates and to other humans
          on shared projects)
        </li>
        <li>
          Documents you upload to a project's brain (PDF, DOCX, TXT, MD; 10 MB
          maximum per file)
        </li>
        <li>
          Feedback you provide on AI responses (thumbs up / thumbs down)
        </li>
        <li>
          Session and operational metadata (timestamps, IP address for security
          logging, browser user-agent for compatibility detection)
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        How We Use Your Information
      </h2>
      <p className="mt-3">
        We use your information to operate the Hatchin service: to recognize
        you when you return, to render your projects and conversation history,
        to generate AI responses from the LLM providers listed below, to bill
        you for paid plans, and to investigate and prevent abuse. We do not
        sell your information, and we do not use your chat content to train
        Hatchin's own AI models. AI providers we route prompts to may retain
        and process those prompts under their own published terms — see the
        next section.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Data Processors and Third Parties
      </h2>
      <p className="mt-3">
        Hatchin relies on the following third-party processors to operate the
        service. Data shared with each is limited to what each processor needs
        to perform its function:
      </p>
      <ul className="mt-3 list-disc list-inside space-y-2">
        <li>
          <strong>Google (Identity)</strong> — verifies your identity at sign-in
          via OAuth 2.0. We receive your email, name, and profile picture from
          Google. Google's privacy practices are governed by{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 underline"
          >
            Google's Privacy Policy
          </a>
          .
        </li>
        <li>
          <strong>Neon (Database hosting)</strong> — provides our PostgreSQL
          database, hosted in the United States. All of your account data,
          messages, and project content live here.
        </li>
        <li>
          <strong>Stripe (Billing)</strong> — handles paid-plan billing if you
          upgrade to Pro. Card numbers, billing addresses, and other payment
          PII are collected and stored by Stripe, not by Hatchin. We store only
          a Stripe customer identifier and your current subscription status in
          our database. Stripe is PCI-DSS compliant.
        </li>
        <li>
          <strong>DeepSeek (LLM — primary, hosted in China)</strong> — our
          primary AI model provider. Most chat messages and autonomous work
          are processed by DeepSeek's V4 models, which are hosted in China.
          See the dedicated disclosure below.
        </li>
        <li>
          <strong>Gemini, by Google (LLM — hot fallback, US)</strong> — if
          DeepSeek is unavailable or rate-limited, Hatchin transparently falls
          back to Google's Gemini 2.5 Flash / Pro models. Gemini is hosted by
          Google in the United States.
        </li>
        <li>
          <strong>Groq (LLM — free-tier path, US)</strong> — for specific
          lightweight workloads (simple chat turns, task extraction,
          conversation compaction), Hatchin routes through Groq's hosted
          Llama 3.3-70B service to reduce cost. Groq is hosted in the United
          States.
        </li>
      </ul>
      <p className="mt-4">
        When you send a message in chat, we route it to one of our LLM
        providers depending on the workload. Our primary provider is DeepSeek
        (hosted in China) — most chat messages and autonomous work go there.
        If DeepSeek is unavailable or for specific workloads (simple chat,
        task extraction, conversation compaction), we route to Gemini (Google,
        US) or Groq (US). These providers process your prompt under their own
        privacy terms and may retain inputs for abuse-detection per their
        published policies. If you do not want your content sent to a
        China-hosted provider, contact us at{" "}
        <a
          href="mailto:hello@hatchin.ai"
          className="text-indigo-600 hover:text-indigo-800 underline"
        >
          hello@hatchin.ai
        </a>{" "}
        before sending sensitive material — per-customer routing overrides are
        available on request.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Cookies
      </h2>
      <p className="mt-3">
        We use a single session cookie to keep you signed in. The cookie is
        httpOnly (not readable by JavaScript), Secure (transmitted only over
        HTTPS in production), and SameSite=Lax (sent only to Hatchin on
        top-level navigations). It has a 7-day TTL — signing out, or
        inactivity past 7 days, ends the session. We do not use third-party
        advertising cookies or cross-site trackers.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Data Retention
      </h2>
      <p className="mt-3">
        Your account, projects, conversations, and uploaded brain documents
        persist until you request deletion. We do not yet have an automatic
        retention policy that ages out old data — content remains in your
        account indefinitely until you remove it or close the account.
        Operational logs (security and abuse-prevention) are retained for up
        to 30 days. Billing records are retained as required by tax law,
        typically 7 years.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Your Rights
      </h2>
      <p className="mt-3">
        You can:
      </p>
      <ul className="mt-3 list-disc list-inside space-y-1">
        <li>Request a copy of the data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>
          Request account deletion and removal of all associated data — email
          us at{" "}
          <a
            href="mailto:hello@hatchin.ai"
            className="text-indigo-600 hover:text-indigo-800 underline"
          >
            hello@hatchin.ai
          </a>
          . Self-service deletion is on our roadmap.
        </li>
        <li>
          Request that your prompts not be routed to a China-hosted provider
          (DeepSeek). We will configure per-customer routing overrides on
          request.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Changes to This Policy
      </h2>
      <p className="mt-3">
        We may update this policy as Hatchin evolves — for example, when we
        add or remove a data processor. Material changes will be announced
        in-app at next sign-in. The "Last updated" date at the top of this
        page always reflects the current version.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-slate-900">
        Contact
      </h2>
      <p className="mt-3">
        Questions about this policy, a deletion request, or a per-customer
        routing override — email{" "}
        <a
          href="mailto:hello@hatchin.ai"
          className="text-indigo-600 hover:text-indigo-800 underline"
        >
          hello@hatchin.ai
        </a>
        .
      </p>
    </div>
  );
}
