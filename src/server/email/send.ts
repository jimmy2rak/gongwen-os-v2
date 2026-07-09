// ─── Brevo 邮件发送工具（REST API 版） ──────────────
// 使用 Brevo v3 Transactional Email API 发送交易邮件
// 环境变量：BREVO_API_KEY（以 xkeysib- 开头的 API Key，不是 SMTP Key）

const FROM = process.env.EMAIL_FROM || "noreply@gongwenos.182183.xyz";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "公文 OS";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[email] BREVO_API_KEY 未配置，邮件功能不可用");
    return false;
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("[email] Brevo API 返回错误:", res.status, body);
      return false;
    }

    const data = await res.json().catch(() => ({}));
    console.log("[email] 发送成功:", data.messageId || "OK");
    return true;
  } catch (err) {
    console.error("[email] 发送失败:", err);
    return false;
  }
}

/** 发送密码重置邮件 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const url = `${process.env.NEXTAUTH_URL || "https://gongwenos.182183.xyz"}/reset-password?token=${token}`;
  return sendEmail(
    to,
    "【公文 OS】重置密码",
    `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;">
      <h2 style="font-size:18px;margin-bottom:16px;">重置密码</h2>
      <p style="font-size:14px;line-height:1.6;color:#333;">您好，</p>
      <p style="font-size:14px;line-height:1.6;color:#333;">
        我们收到了您重置密码的请求。请点击下方按钮设置新密码：
      </p>
      <a href="${url}"
         style="display:inline-block;margin:20px 0;padding:12px 28px;background:#163f3a;color:#fff;
                text-decoration:none;border-radius:8px;font-size:14px;">
        重置密码
      </a>
      <p style="font-size:12px;color:#999;margin-top:20px;">
        此链接 30 分钟内有效。如非本人操作，请忽略此邮件。
      </p>
      <p style="font-size:12px;color:#999;">— 公文 OS 团队</p>
    </div>`,
  );
}

/** 发送登录验证码邮件（包含验证码和 Magic Link） */
export async function sendLoginCodeEmail(to: string, code: string, magicUrl: string): Promise<boolean> {
  return sendEmail(
    to,
    "【公文 OS】登录验证码",
    `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;">
      <h2 style="font-size:18px;margin-bottom:16px;">登录验证码</h2>
      <p style="font-size:14px;line-height:1.6;color:#333;">您好，</p>
      <p style="font-size:14px;line-height:1.6;color:#333;">您的登录验证码为：</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#163f3a;">${code}</span>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#333;">验证码 10 分钟内有效。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:13px;color:#666;">或点击下方链接直接登录（无需输入密码）：</p>
      <a href="${magicUrl}"
         style="display:inline-block;margin:8px 0;padding:10px 24px;background:#163f3a;color:#fff;
                text-decoration:none;border-radius:8px;font-size:13px;">
        一键登录
      </a>
      <p style="font-size:12px;color:#999;margin-top:20px;">
        如非本人操作，请忽略此邮件。
      </p>
      <p style="font-size:12px;color:#999;">— 公文 OS 团队</p>
    </div>`,
  );
}
