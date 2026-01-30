import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");
    
    const { priceId, mode } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    
    logStep("Request params", { priceId, mode });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) throw new Error(`Auth error: ${authError.message}`);
    
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured. Add it in Supabase Dashboard > Edge Functions > Secrets");
    }
    
    // Validate key format
    if (stripeKey.startsWith("pk_")) {
      throw new Error("Invalid key type: STRIPE_SECRET_KEY contains publishable key (pk_*). Need secret key (sk_*)");
    }
    if (stripeKey.startsWith("rk_")) {
      throw new Error("Restricted keys not supported. Use full secret key (sk_test_* or sk_live_*)");
    }
    
    logStep("Stripe key found and validated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Determine checkout mode based on price type
    const checkoutMode = mode === "subscription" ? "subscription" : "payment";
    logStep("Checkout mode", { checkoutMode });

    // Récupérer les infos du prix pour les passer à la page succès
    logStep("Retrieving price", { priceId });
    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === "string" ? price.product : (price.product as any).id;
    logStep("Price retrieved", { productId });
    
    const product = await stripe.products.retrieve(productId);
    logStep("Product retrieved", { productName: product.name });
    
    const origin = req.headers.get("origin") || "https://auto-host-forge.lovable.app";
    
    const successParams = new URLSearchParams({
      price_id: priceId,
      product_id: productId,
      product_name: encodeURIComponent(product.name),
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: checkoutMode as "payment" | "subscription",
      success_url: `${origin}/sportif/paiement-succes?${successParams.toString()}`,
      cancel_url: `${origin}/sportif/paiement`,
      metadata: {
        user_id: user.id,
        price_id: priceId,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
