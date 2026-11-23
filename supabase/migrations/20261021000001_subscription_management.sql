-- ==============================================================================
-- SmartResolve / Fixnora Subscription Management & Automated Billing Migration
-- Supports Hostel Plan (₹800/mo) and Society Plan (₹2000/mo)
-- Automated recurring subscriptions, invoices with 18% GST (SAC 998314),
-- renewal reminder logs, and multi-tenant RLS policies.
-- ==============================================================================

-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    plan_type text NOT NULL CHECK (plan_type IN ('hostel', 'society')),
    plan_name text NOT NULL,
    billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
    amount numeric(10, 2) NOT NULL,
    currency text NOT NULL DEFAULT 'INR',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL,
    next_billing_at timestamptz NOT NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    auto_renewal boolean NOT NULL DEFAULT true,
    payment_method_type text NOT NULL DEFAULT 'upi_autopay' CHECK (payment_method_type IN ('upi_autopay', 'card', 'netbanking')),
    payment_method_last4 text,
    payment_method_brand text,
    upi_id text,
    mandate_id text,
    grace_period_until timestamptz,
    failed_attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_society_subscription UNIQUE (society_id)
);

-- 2. Subscription Invoices & Payment History Table
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    invoice_number text NOT NULL UNIQUE,
    plan_type text NOT NULL CHECK (plan_type IN ('hostel', 'society')),
    plan_name text NOT NULL,
    base_amount numeric(10, 2) NOT NULL,
    tax_amount numeric(10, 2) NOT NULL,
    cgst numeric(10, 2) NOT NULL,
    sgst numeric(10, 2) NOT NULL,
    igst numeric(10, 2) NOT NULL DEFAULT 0.00,
    total_amount numeric(10, 2) NOT NULL,
    sac_code text NOT NULL DEFAULT '998314',
    currency text NOT NULL DEFAULT 'INR',
    status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'failed', 'pending', 'refunded')),
    payment_method text NOT NULL DEFAULT 'UPI AutoPay',
    gateway_payment_id text,
    failure_reason text,
    retry_count integer NOT NULL DEFAULT 0,
    billing_period_start timestamptz NOT NULL,
    billing_period_end timestamptz NOT NULL,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Renewal Reminder Log Table
CREATE TABLE IF NOT EXISTS public.subscription_renewal_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    days_before integer NOT NULL,
    due_date timestamptz NOT NULL,
    amount numeric(10, 2) NOT NULL,
    status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'pending')),
    channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'whatsapp')),
    sent_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_renewal_reminders ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Society Admins and Platform Admins can view/manage
CREATE POLICY "Admins can view society subscriptions"
    ON public.subscriptions
    FOR SELECT
    USING (
        public.is_platform_admin() OR
        public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    );

CREATE POLICY "Admins can update society subscriptions"
    ON public.subscriptions
    FOR ALL
    USING (
        public.is_platform_admin() OR
        public.has_society_role(society_id, ARRAY['society_admin'])
    );

CREATE POLICY "Admins can view subscription invoices"
    ON public.subscription_invoices
    FOR SELECT
    USING (
        public.is_platform_admin() OR
        public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    );

CREATE POLICY "Platform admins can manage invoices"
    ON public.subscription_invoices
    FOR ALL
    USING (public.is_platform_admin());

CREATE POLICY "Admins can view renewal reminders"
    ON public.subscription_renewal_reminders
    FOR SELECT
    USING (
        public.is_platform_admin() OR
        public.has_society_role(society_id, ARRAY['society_admin'])
    );

-- 6. Trigger for updated_at
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
