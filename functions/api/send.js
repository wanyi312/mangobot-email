// 导入 Resend SDK
import { Resend } from 'resend';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

export async function onRequestPost({ request, env }) {
  try {
    // 从请求中解析 JSON 数据
    const { to, subject, html, text } = await request.json();

    // 检查必要的参数
    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, and html/text' }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
      });
    }

    // 检查是否配置了 API Key
    if (!env.RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured in environment variables' }), {
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
      });
    }

    // 初始化 Resend 客户端
    const resend = new Resend(env.RESEND_API_KEY);

    // 发送邮件
    // 注意：默认情况下，Resend 的免费层级通常只允许发送到经过验证的邮箱，或者使用 onboarding@resend.dev 作为发件人发给自己
    // 这里假设用户已经配置好了发件域名或者在测试模式
    const from = env.SENDER_EMAIL || 'onboarding@resend.dev'; // 建议在环境变量中配置发件人

    const { data, error } = await resend.emails.send({
      from: from,
      to: to,
      subject: subject,
      html: html,
      text: text,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
      });
    }

    return new Response(JSON.stringify({ message: 'Email sent successfully', id: data.id }), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
    });
  }
}
