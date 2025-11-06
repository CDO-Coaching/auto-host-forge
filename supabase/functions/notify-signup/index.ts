import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const coachEmail = Deno.env.get("COACH_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupNotificationRequest {
  email: string;
  signupDate: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, signupDate }: SignupNotificationRequest = await req.json();

    console.log(`Nouvelle inscription détectée: ${email} à ${signupDate}`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CDO Coaching <onboarding@resend.dev>",
        to: [coachEmail],
        subject: "🎉 Nouvelle inscription sur CDO Coaching",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 20px;">
              Nouvelle inscription ! 🎉
            </h1>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-size: 16px;">
                <strong>Email:</strong> ${email}
              </p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <strong>Date d'inscription:</strong> ${new Date(signupDate).toLocaleString('fr-FR')}
              </p>
            </div>
            
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              Une nouvelle personne vient de créer un compte sur ta plateforme CDO Coaching. 
              Tu peux maintenant te connecter à ton tableau de bord pour approuver ce nouveau membre.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Cet email a été envoyé automatiquement depuis ta plateforme CDO Coaching.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Erreur Resend:", errorData);
      throw new Error(`Resend API error: ${emailResponse.status}`);
    }

    const data = await emailResponse.json();

    console.log("Email envoyé avec succès:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erreur dans notify-signup:", error);
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
