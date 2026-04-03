import { Resend } from 'resend';
import { corsHeaders, jsonResponse } from './utils.js';
import { readSubscribers } from './subscribers.js';
import { handleSubscribe } from './handlers/subscribe.js';
import { handleCancel } from './handlers/cancel.js';
import { handleSend } from './handlers/send.js';

export default {
  // HTTP 请求处理
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === 'POST') {
      switch (url.pathname) {
        case '/api/send':
          return handleSend(request, env);
        case '/api/subscribe':
          return handleSubscribe(request, env);
        case '/api/cancel':
          return handleCancel(request, env);
      }
    }

    // 静态页面或 404
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({ message: 'Not Found' }, 404);
  },

  // Email Worker：接收邮件并转发给订阅者
  async email(message, env, ctx) {
    const filterSender = env.FILTER_SENDER || 'wy776723419@gmail.com';
    const filterSubject = env.FILTER_SUBJECT_PREFIX || 'mangobot最新';

    // 1. 过滤发件人
    if (message.from !== filterSender) {
      console.log(`Ignored email from ${message.from}, expected ${filterSender}`);
      return;
    }

    // 2. 读取邮件原始内容
    const rawEmail = await new Response(message.raw).text();

    // 3. 解析邮件头和正文
    const { subject, html, text } = parseEmail(rawEmail);

    // 4. 过滤主题前缀
    if (!subject.startsWith(filterSubject)) {
      console.log(`Ignored email with subject "${subject}", expected prefix "${filterSubject}"`);
      return;
    }

    // 5. 去重检查（用邮件 Message-ID）
    const messageId = message.headers.get('message-id') || `${Date.now()}`;
    if (env.PROCESSED_EMAILS) {
      const alreadyProcessed = await env.PROCESSED_EMAILS.get(messageId);
      if (alreadyProcessed) {
        console.log(`Already processed: ${messageId}`);
        return;
      }
    }

    // 6. 读取订阅者列表
    const subscribers = await readSubscribers(env);
    if (subscribers.length === 0) {
      console.log('No subscribers found');
      return;
    }

    // 7. 通过 Resend 转发给所有订阅者
    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.SENDER_EMAIL || 'onboarding@resend.dev';

    const sendPromises = subscribers.map(subscriber =>
      resend.emails.send({
        from,
        to: subscriber,
        subject: `[转发] ${subject}`,
        html: html || undefined,
        text: text || undefined,
      })
    );

    const results = await Promise.allSettled(sendPromises);

    // 详细日志
    let succeeded = 0;
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const response = result.value;
        // 检查是否有错误（Resend 返回 {data: null, error: {...}}）
        if (response?.error) {
          console.log(`✗ Failed to ${subscribers[index]}: ${response.error.message}`);
          failed++;
        } else {
          const emailId = response?.data?.id || response?.id || 'unknown';
          console.log(`✓ Sent to ${subscribers[index]}, ID: ${emailId}`);
          succeeded++;
        }
      } else {
        console.log(`✗ Failed to ${subscribers[index]}: ${result.reason?.message || result.reason}`);
        failed++;
      }
    });

    console.log(`Summary: ${succeeded} succeeded, ${failed} failed`);

    // 8. 标记为已处理
    if (env.PROCESSED_EMAILS) {
      await env.PROCESSED_EMAILS.put(messageId, new Date().toISOString(), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 天后过期
      });
    }
  },
};

/**
 * 解析原始邮件内容，提取 subject、html、text
 */
function parseEmail(rawEmail) {
  let subject = '';
  let html = '';
  let text = '';

  // 分离邮件头和正文
  const headerEndIndex = rawEmail.indexOf('\r\n\r\n');
  const headerPart = headerEndIndex > -1 ? rawEmail.substring(0, headerEndIndex) : rawEmail;
  const bodyPart = headerEndIndex > -1 ? rawEmail.substring(headerEndIndex + 4) : '';

  // 提取 Subject（处理多行折叠）
  const subjectMatch = headerPart.match(/^Subject:\s*(.+(?:\r?\n[ \t]+.+)*)/mi);
  if (subjectMatch) {
    subject = subjectMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim();
    subject = decodeMimeWords(subject);
  }

  // 检查是否是 multipart 邮件
  const contentTypeMatch = headerPart.match(/^Content-Type:\s*(.+(?:\r?\n[ \t]+.+)*)/mi);
  const contentType = contentTypeMatch ? contentTypeMatch[1].replace(/\r?\n[ \t]+/g, ' ') : '';

  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
  if (boundaryMatch) {
    // multipart 邮件
    const boundary = boundaryMatch[1];
    const parts = bodyPart.split(`--${boundary}`);

    for (const part of parts) {
      if (part.trim() === '--' || part.trim() === '') continue;

      const partHeaderEnd = part.indexOf('\r\n\r\n');
      if (partHeaderEnd === -1) continue;

      const partHeader = part.substring(0, partHeaderEnd);
      let partBody = part.substring(partHeaderEnd + 4).trim();

      const encodingMatch = partHeader.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : '7bit';

      if (encoding === 'base64') {
        partBody = atob(partBody.replace(/\s/g, ''));
      } else if (encoding === 'quoted-printable') {
        partBody = decodeQuotedPrintable(partBody);
      }

      if (partHeader.includes('text/html')) {
        html = partBody;
      } else if (partHeader.includes('text/plain')) {
        text = partBody;
      }
    }
  } else {
    // 单一内容邮件
    if (contentType.includes('text/html')) {
      html = bodyPart;
    } else {
      text = bodyPart;
    }
  }

  return { subject, html, text };
}

/**
 * 解码 MIME encoded-word
 */
function decodeMimeWords(str) {
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (match, charset, encoding, encoded) => {
    if (encoding.toUpperCase() === 'B') {
      return atob(encoded);
    } else {
      return decodeQuotedPrintable(encoded.replace(/_/g, ' '));
    }
  });
}

/**
 * 解码 Quoted-Printable
 */
function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
