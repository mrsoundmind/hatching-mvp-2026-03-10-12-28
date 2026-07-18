import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CreditCard,
  Zap,
  Calendar,
  MessageSquare,
  Coins,
  DollarSign,
  Loader2,
  AlertCircle,
  Crown,
} from "lucide-react";

interface BillingStatus {
  tier: "free" | "pro";
  subscriptionStatus: string;
  subscriptionPeriodEnd: string | null;
  graceExpiresAt: string | null;
  usage: {
    dailyMessages: number;
    // dailyMessageLimit removed — messages are unlimited
    monthlyTokens: number;
    monthlyCostCents: number;
    daysInMonth: number;
  };
}

async function fetchBillingStatus(): Promise<BillingStatus> {
  const res = await fetch("/api/billing/status", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to fetch billing status: ${res.status}`);
  }
  return res.json();
}

async function redirectToPortal() {
  // #136: on failure (e.g. Stripe unconfigured -> 503) this used to throw into an unhandled
  // promise rejection, so the button did nothing with no feedback. Surface a clear toast instead.
  try {
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`portal ${res.status}`);
    const { url } = await res.json();
    window.location.href = url;
  } catch {
    toast({
      title: "Subscription management unavailable",
      description: "We couldn't open the billing portal right now. Please try again in a bit.",
      variant: "destructive",
    });
  }
}

async function redirectToCheckout() {
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`checkout ${res.status}`);
    const { url } = await res.json();
    window.location.href = url;
  } catch {
    toast({
      title: "Checkout unavailable",
      description: "We couldn't start checkout right now. Please try again in a bit.",
      variant: "destructive",
    });
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function AccountPage() {
  const { user } = useAuth();

  const {
    data: billing,
    isLoading,
    isError,
    error,
  } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: fetchBillingStatus,
    enabled: !!user,
  });

  const isPro = billing?.tier === "pro";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
          <h1 className="text-2xl font-semibold">Account & Billing</h1>
          {user && (
            <p className="text-muted-foreground mt-1">
              {user.name} ({user.email})
            </p>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading billing info...</span>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">Failed to load billing information</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "An unexpected error occurred."}
              </p>
            </div>
          </div>
        )}

        {/* Billing content */}
        {billing && (
          <div className="space-y-6">
            {/* Plan card */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {isPro ? (
                    <Crown className="w-5 h-5 text-amber-500" />
                  ) : (
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <h2 className="text-lg font-medium">
                      {isPro ? "Pro Plan" : "Free Plan"}
                    </h2>
                    {billing.subscriptionStatus && billing.subscriptionStatus !== 'none' && (
                      <p className="text-sm text-muted-foreground capitalize">
                        Status: {billing.subscriptionStatus}
                      </p>
                    )}
                  </div>
                </div>
                {isPro && (
                  <span className="text-sm font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    $19/mo
                  </span>
                )}
              </div>

              {isPro && billing.subscriptionPeriodEnd && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>Current period ends {formatDate(billing.subscriptionPeriodEnd)}</span>
                </div>
              )}

              {billing.graceExpiresAt && new Date(billing.graceExpiresAt) > new Date() && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Pro trial ends {formatDate(billing.graceExpiresAt)} — upgrade to keep all features
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                {isPro ? (
                  <button
                    onClick={redirectToPortal}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-accent transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Manage Subscription
                  </button>
                ) : (
                  <button
                    onClick={redirectToCheckout}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    Upgrade to Pro
                  </button>
                )}
              </div>
            </div>

            {/* Usage card */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-medium mb-4">Usage</h2>
              <div className="space-y-4">
                {/* Daily messages — no limit, just show count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span>Messages today</span>
                  </div>
                  <span className="text-sm font-mono">
                    {formatNumber(billing.usage.dailyMessages)}
                  </span>
                </div>

                {/* Monthly tokens */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-4 text-muted-foreground" />
                    <span>Monthly tokens</span>
                  </div>
                  <span className="text-sm font-mono">
                    {formatNumber(billing.usage.monthlyTokens)}
                  </span>
                </div>

                {/* Monthly cost */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>Estimated monthly cost</span>
                  </div>
                  <span className="text-sm font-mono">
                    ${(billing.usage.monthlyCostCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
