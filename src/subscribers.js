export async function readSubscribers(env) {
  if (env.SUBSCRIBERS) {
    const data = await env.SUBSCRIBERS.get('list');
    return data ? JSON.parse(data) : [];
  }
  return [];
}

export async function writeSubscribers(env, subscribers) {
  if (env.SUBSCRIBERS) {
    await env.SUBSCRIBERS.put('list', JSON.stringify(subscribers));
  }
}
