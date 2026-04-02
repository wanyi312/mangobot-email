import { Resend } from 'resend';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function handleSend(request, env) {
  try {
    const { to, subject, html, text } = await request.json();

    if (!to || !subject || (!html && !text)) {
      return jsonResponse({ error: 'Missing required fields: to, subject, and html/text' }, 400);
    }

    if (!env.RESEND_API_KEY) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 500);
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.SENDER_EMAIL || 'onboarding@resend.dev';

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      return jsonResponse({ error }, 400);
    }

    return jsonResponse({ message: 'Email sent successfully', id: data.id });
  } catch (err) {
    return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
  }
}
