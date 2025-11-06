import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const coachEmail = Deno.env.get("COACH_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactNotificationRequest {
  prénom: string;
  nom: string;
  email: string;
  telephone?: string;
  message: string;
  mode_de_contact: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prénom, nom, email, telephone, message, mode_de_contact }: ContactNotificationRequest = await req.json();

    console.log(`Nouvelle demande de contact de: ${prénom} ${nom}`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CDO Coaching <onboarding@resend.dev>",
        to: [coachEmail],
        subject: "📞 Nouvelle demande de contact - CDO Coaching",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 20px;">
              📞 Nouvelle demande de contact !
            </h1>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="font-size: 18px; margin: 0 0 15px 0; color: #1f2937;">
                Coordonnées :
              </h2>
              <p style="margin: 8px 0; font-size: 16px;">
                <strong>Nom complet :</strong> ${prénom} ${nom}
              </p>
              <p style="margin: 8px 0; font-size: 16px;">
                <strong>Email :</strong> <a href="mailto:${email}" style="color: #f59e0b;">${email}</a>
              </p>
              ${telephone ? `
                <p style="margin: 8px 0; font-size: 16px;">
                  <strong>Téléphone :</strong> <a href="tel:${telephone}" style="color: #f59e0b;">${telephone}</a>
                </p>
              ` : ''}
              <p style="margin: 8px 0; font-size: 16px;">
                <strong>Mode de contact préféré :</strong> ${mode_de_contact}
              </p>
            </div>
            
            <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
              <h3 style="font-size: 16px; margin: 0 0 10px 0; color: #1f2937;">
                Message :
              </h3>
              <p style="color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 0;">
${message}
              </p>
            </div>
            
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              Une nouvelle personne souhaite être contactée. Tu peux lui répondre directement ${mode_de_contact === 'par email' ? 'par email' : 'par téléphone'}.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                🕐 Demande reçue le ${new Date().toLocaleString('fr-FR', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">
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
    console.error("Erreur dans notify-contact:", error);
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
