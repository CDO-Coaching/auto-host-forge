import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RETENTION_MONTHS = 6;

const handler = async (req: Request): Promise<Response> => {
  console.log("cleanup-old-attachments function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Cron secret guard: only pg_cron (with correct token) may call this ───
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    console.error("CRON_SECRET env var not configured");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized: missing or invalid cron token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (6 months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);
    const cutoffDateISO = cutoffDate.toISOString();

    console.log(`Looking for attachments older than: ${cutoffDateISO}`);

    // Find messages with attachments older than 6 months
    const { data: oldMessages, error: fetchError } = await supabase
      .from("messages")
      .select("id, attachment_url, attachment_type, created_at, sender_id, content")
      .not("attachment_url", "is", null)
      .lt("created_at", cutoffDateISO);

    if (fetchError) {
      console.error("Error fetching old messages:", fetchError);
      throw fetchError;
    }

    if (!oldMessages || oldMessages.length === 0) {
      console.log("No attachments found older than 6 months");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No attachments to clean up",
          deletedCount: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${oldMessages.length} attachments to clean up`);

    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const message of oldMessages) {
      try {
        // Extract the file path from the URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/chat-attachments/user_id/timestamp.ext
        const url = new URL(message.attachment_url);
        const pathParts = url.pathname.split("/chat-attachments/");
        
        if (pathParts.length < 2) {
          console.error(`Could not parse file path from URL: ${message.attachment_url}`);
          errorCount++;
          continue;
        }

        const filePath = pathParts[1];
        console.log(`Deleting file: ${filePath}`);

        // Delete the file from storage
        const { error: deleteStorageError } = await supabase.storage
          .from("chat-attachments")
          .remove([filePath]);

        if (deleteStorageError) {
          console.error(`Error deleting file ${filePath}:`, deleteStorageError);
          errors.push(`File ${filePath}: ${deleteStorageError.message}`);
          errorCount++;
          continue;
        }

        // Update the message to remove attachment reference
        const { error: updateError } = await supabase
          .from("messages")
          .update({
            attachment_url: null,
            attachment_type: null,
            content: message.content?.includes("📹") || message.content?.includes("📷")
              ? `${message.content} [Pièce jointe supprimée après 6 mois - RGPD]`
              : `[Pièce jointe supprimée après 6 mois - RGPD]`
          })
          .eq("id", message.id);

        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError);
          errors.push(`Message ${message.id}: ${updateError.message}`);
          errorCount++;
          continue;
        }

        deletedCount++;
        console.log(`Successfully deleted attachment for message ${message.id}`);
      } catch (err) {
        console.error(`Error processing message ${message.id}:`, err);
        errors.push(`Message ${message.id}: ${String(err)}`);
        errorCount++;
      }
    }

    const summary = {
      success: true,
      message: `Cleanup completed`,
      totalFound: oldMessages.length,
      deletedCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
      cutoffDate: cutoffDateISO,
    };

    console.log("Cleanup summary:", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in cleanup-old-attachments function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
