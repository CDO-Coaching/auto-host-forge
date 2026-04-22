import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SfmsNotifyRequest {
  athlete_id: string;
  total_score: number;
  scores: {
    fatigue_physique: number;
    performance: number;
    psychologique: number;
    cognitif: number;
    sommeil_appetit: number;
    physiologique: number;
  };
}

const DIM_LABELS: Record<string, string> = {
  fatigue_physique: "Fatigue physique",
  performance: "Performance",
  psychologique: "État psychologique",
  cognitif: "Fonctions cognitives",
  sommeil_appetit: "Sommeil et appétit",
  physiologique: "Signes physiologiques",
};

const DIM_TOTALS: Record<string, number> = {
  fatigue_physique: 7,
  performance: 8,
  psychologique: 14,
  cognitif: 5,
  sommeil_appetit: 6,
  physiologique: 14,
};

function getLevel(score: number) {
  if (score < 10) return { label: "Pas de signe particulier", color: "#10b981" };
  if (score < 20) return { label: "Fatigue à surveiller", color: "#eab308" };
  if (score < 27) return { label: "Seuil d'alerte – possible surentraînement", color: "#f97316" };
  return { label: "Surentraînement probable", color: "#dc2626" };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { athlete_id, total_score, scores }: SfmsNotifyRequest = await req.json();

    if (!athlete_id || total_score === undefined || !scores) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Trouver le coach via la relation
    const { data: relation, error: relError } = await admin
      .from("coach_athlete_relationships")
      .select("coach_id")
      .eq("athlete_id", athlete_id)
      .eq("status", "approved")
      .maybeSingle();

    if (relError) console.error("Relation lookup error:", relError);
    if (!relation?.coach_id) {
      console.log("No coach found for athlete", athlete_id);
      return new Response(JSON.stringify({ success: true, skipped: "no_coach" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Récupérer email du coach + nom de l'athlète
    const [coachRes, athleteRes] = await Promise.all([
      admin.from("user_profiles").select("email, first_name").eq("id", relation.coach_id).maybeSingle(),
      admin.from("user_profiles").select("first_name, last_name").eq("id", athlete_id).maybeSingle(),
    ]);

    const coachEmail = coachRes.data?.email;
    if (!coachEmail) {
      console.log("No coach email found");
      return new Response(JSON.stringify({ success: true, skipped: "no_coach_email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const athleteName =
      `${athleteRes.data?.first_name ?? ""} ${athleteRes.data?.last_name ?? ""}`.trim() ||
      "Un de tes athlètes";

    const level = getLevel(total_score);

    // Trier dimensions par ratio
    const dimsSorted = Object.entries(scores)
      .map(([k, v]) => ({
        key: k,
        label: DIM_LABELS[k],
        raw: v,
        total: DIM_TOTALS[k],
        ratio: DIM_TOTALS[k] > 0 ? (v / DIM_TOTALS[k]) * 100 : 0,
      }))
      .filter((d) => d.raw > 0)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 2);

    const dimsHtml = dimsSorted
      .map(
        (d) => `
          <li style="margin: 6px 0;">
            <strong>${d.label}</strong> — ${d.raw}/${d.total} (${Math.round(d.ratio)}%)
          </li>`
      )
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: ${level.color}; font-size: 22px; margin-bottom: 16px;">
          🩺 Questionnaire surentraînement (SFMS)
        </h1>
        <p style="font-size: 16px; color: #1f2937;">
          <strong>${athleteName}</strong> vient de compléter le questionnaire de surentraînement.
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;">
            <strong>Score total :</strong>
            <span style="color: ${level.color}; font-weight: bold; font-size: 20px;">
              ${total_score}/54
            </span>
          </p>
          <p style="margin: 8px 0 0 0; color: ${level.color}; font-weight: 600;">
            ${level.label}
          </p>
        </div>

        ${
          dimsSorted.length > 0
            ? `
          <div style="background-color: #fff7ed; padding: 16px; border-radius: 8px; border-left: 4px solid ${level.color};">
            <h3 style="font-size: 15px; margin: 0 0 10px 0; color: #1f2937;">
              Dimension${dimsSorted.length > 1 ? "s" : ""} dominante${dimsSorted.length > 1 ? "s" : ""} :
            </h3>
            <ul style="margin: 0; padding-left: 18px; color: #374151;">
              ${dimsHtml}
            </ul>
          </div>
        `
            : ""
        }

        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-top: 20px;">
          Connecte-toi sur la plateforme pour consulter le détail des recommandations
          sur la fiche de l'athlète.
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            🕐 Reçu le ${new Date().toLocaleString("fr-FR", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CDO Coaching <onboarding@resend.dev>",
        to: [coachEmail],
        subject: `🩺 Questionnaire SFMS – ${athleteName} (${total_score}/54)`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      throw new Error(`Resend API error: ${emailResponse.status}`);
    }

    const data = await emailResponse.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("notify-sfms-result error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
