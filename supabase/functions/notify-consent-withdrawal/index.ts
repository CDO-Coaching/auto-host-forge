import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConsentWithdrawalRequest {
  userEmail: string;
  userName: string;
  withdrawalDate: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-consent-withdrawal function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, withdrawalDate }: ConsentWithdrawalRequest = await req.json();

    console.log(`Processing consent withdrawal notification for: ${userEmail}`);

    const coachEmail = Deno.env.get("COACH_EMAIL") || "corentin@cdocoaching.com";

    const emailResponse = await resend.emails.send({
      from: "CDO Coaching <onboarding@resend.dev>",
      to: [coachEmail],
      subject: `⚠️ Retrait de consentement RGPD - ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #e74c3c;">⚠️ Notification de retrait de consentement</h1>
          
          <p>Un athlète a retiré son consentement au traitement de ses données de santé.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Informations de l'athlète :</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Nom :</strong> ${userName}</li>
              <li><strong>Email :</strong> ${userEmail}</li>
              <li><strong>Date du retrait :</strong> ${new Date(withdrawalDate).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</li>
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h4 style="margin-top: 0; color: #856404;">⚠️ Actions requises :</h4>
            <p style="margin-bottom: 0; color: #856404;">
              Conformément au RGPD, les données de santé de cet athlète ne doivent plus être collectées 
              ni traitées à des fins d'adaptation des entraînements.
            </p>
          </div>
          
          <p style="color: #6c757d; font-size: 12px; margin-top: 30px;">
            Ce message a été envoyé automatiquement par l'application CDO Coaching.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-consent-withdrawal function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
