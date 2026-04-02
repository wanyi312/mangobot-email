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

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function readSubscribers(env) {
  if (env.SUBSCRIBERS) {
    const data = await env.SUBSCRIBERS.get('list');
    return data ? JSON.parse(data) : [];
  }
  return [];
}

async function writeSubscribers(env, subscribers) {
  if (env.SUBSCRIBERS) {
    await env.SUBSCRIBERS.put('list', JSON.stringify(subscribers));
  }
}

export async function handleSubscribe(request, env) {
  try {
    const { email } = await request.json();

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ message: 'Invalid email format' }, 400);
    }

    const subscribers = await readSubscribers(env);

    if (subscribers.includes(email)) {
      return jsonResponse({ message: 'Email already subscribed' }, 400);
    }

    subscribers.push(email);
    await writeSubscribers(env, subscribers);

    return jsonResponse({ message: 'Subscription successful' });
  } catch (err) {
    return jsonResponse({ message: 'Internal Server Error: ' + err.message }, 500);
  }
}
