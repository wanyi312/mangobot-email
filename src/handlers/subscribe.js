import { jsonResponse, isValidEmail } from '../utils.js';
import { readSubscribers, writeSubscribers } from '../subscribers.js';

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
