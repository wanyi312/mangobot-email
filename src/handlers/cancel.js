import { jsonResponse, isValidEmail } from '../utils.js';
import { readSubscribers, writeSubscribers } from '../subscribers.js';

export async function handleCancel(request, env) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ message: 'Invalid email format' }, 400);
    }

    const subscribers = await readSubscribers(env);
    const index = subscribers.indexOf(email);

    if (index === -1) {
      return jsonResponse({ message: 'Email not found in subscription list' }, 400);
    }

    subscribers.splice(index, 1);
    await writeSubscribers(env, subscribers);

    return jsonResponse({ message: 'Cancel subscription successful' });
  } catch (err) {
    return jsonResponse({ message: 'Internal Server Error: ' + err.message }, 500);
  }
}
