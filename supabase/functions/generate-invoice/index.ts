import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-INVOICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const coachEmail = Deno.env.get("COACH_EMAIL") ?? "";

  // ── Auth guard: require a valid user JWT ──────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    logStep("Unauthorized: missing Authorization header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  // Verify JWT using the anon client (honours RLS)
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    logStep("Unauthorized: invalid token", { error: authError?.message });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Function started", { userId: user.id });

    const { subscriptionId, athleteId, productName, amount, paidAt } = await req.json();

    if (!subscriptionId || !athleteId || !productName) {
      throw new Error("Missing required fields: subscriptionId, athleteId, productName");
    }

    // Ensure the caller can only generate their own invoice
    if (user.id !== athleteId) {
      logStep("Forbidden: athleteId mismatch", { userId: user.id, athleteId });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("Received params", { subscriptionId, athleteId, productName, amount });

    // Récupérer les infos de l'athlète
    const { data: athlete, error: athleteError } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("id", athleteId)
      .single();

    if (athleteError) {
      logStep("Error fetching athlete", athleteError);
      throw new Error(`Athlete not found: ${athleteError.message}`);
    }

    logStep("Athlete found", { name: `${athlete.first_name} ${athlete.last_name}` });

    // Vérifier si une facture existe déjà pour cet abonnement
    const { data: existingInvoice } = await supabaseClient
      .from("athlete_invoices")
      .select("id, invoice_number")
      .eq("subscription_id", subscriptionId)
      .maybeSingle();

    if (existingInvoice) {
      logStep("Invoice already exists", existingInvoice);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Invoice already exists",
          invoiceNumber: existingInvoice.invoice_number 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer la facture
    const invoiceData = {
      athlete_id: athleteId,
      subscription_id: subscriptionId,
      product_name: productName,
      amount: amount || 0,
      currency: "EUR",
      paid_at: paidAt || new Date().toISOString(),
      status: "paid",
    };

    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("athlete_invoices")
      .insert(invoiceData)
      .select("id, invoice_number")
      .single();

    if (invoiceError) {
      logStep("Error creating invoice", invoiceError);
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    logStep("Invoice created", { invoiceNumber: invoice.invoice_number });

    // Envoyer l'email de confirmation avec la facture
    if (resendApiKey && athlete.email) {
      try {
        const athleteName = `${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || 'Sportif';
        const formattedDate = new Date(paidAt || new Date()).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const formattedAmount = amount 
          ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount / 100)
          : "—";

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de paiement</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">CDO Coaching</h1>
    <p style="color: #a0aec0; margin: 10px 0 0;">Confirmation de paiement</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
    <h2 style="color: #22c55e; margin: 0 0 20px;">✓ Paiement confirmé</h2>
    
    <p>Bonjour ${athleteName},</p>
    
    <p>Nous avons bien reçu votre paiement. Voici le récapitulatif :</p>
    
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b;">N° Facture</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoice.invoice_number}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Formule</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${productName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Montant</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #22c55e;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Date</td>
          <td style="padding: 8px 0; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
    </div>
    
    <p>Vous pouvez consulter l'historique de vos factures dans l'application, section "Mes paiements".</p>
    
    <p style="margin-top: 30px;">Bon entraînement ! 💪</p>
    
    <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
      —<br>
      L'équipe CDO Coaching
    </p>
  </div>
  
  <div style="background: #1a1a2e; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
    <p style="color: #64748b; font-size: 12px; margin: 0;">
      © ${new Date().getFullYear()} CDO Coaching. Tous droits réservés.
    </p>
  </div>
</body>
</html>
        `;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "CDO Coaching <noreply@cdocoaching.com>",
            to: [athlete.email],
            subject: `Confirmation de paiement - ${productName}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          logStep("Email sent to athlete", { email: athlete.email });
          
          // Marquer la facture comme envoyée
          await supabaseClient
            .from("athlete_invoices")
            .update({ email_sent: true, email_sent_at: new Date().toISOString() })
            .eq("id", invoice.id);
        } else {
          const emailError = await emailResponse.text();
          logStep("Email sending failed", { error: emailError });
        }
      } catch (emailErr) {
        logStep("Email error", { error: emailErr });
      }
    }

    // Notifier le coach si configuré
    if (resendApiKey && coachEmail) {
      try {
        const athleteName = `${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || 'Un sportif';
        const formattedAmount = amount 
          ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount / 100)
          : "—";

        const coachEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nouveau paiement reçu</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 20px;">💰 Nouveau paiement reçu</h1>
  </div>
  
  <div style="background: #f8fafc; padding: 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p><strong>${athleteName}</strong> vient de payer :</p>
    
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 15px 0;">
      <p style="margin: 5px 0;"><strong>Formule :</strong> ${productName}</p>
      <p style="margin: 5px 0;"><strong>Montant :</strong> <span style="color: #22c55e; font-weight: 600;">${formattedAmount}</span></p>
      <p style="margin: 5px 0;"><strong>Facture :</strong> ${invoice.invoice_number}</p>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">
      Connectez-vous à l'application pour voir les détails.
    </p>
  </div>
</body>
</html>
        `;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "CDO Coaching <noreply@cdocoaching.com>",
            to: [coachEmail],
            subject: `💰 Paiement reçu : ${athleteName} - ${productName}`,
            html: coachEmailHtml,
          }),
        });

        logStep("Coach notification sent", { email: coachEmail });
      } catch (coachEmailErr) {
        logStep("Coach email error", { error: coachEmailErr });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceNumber: invoice.invoice_number,
        invoiceId: invoice.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
