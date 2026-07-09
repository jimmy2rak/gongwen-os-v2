// ─── Brevo SMTP 邮件发送工具 ─────────────────────
// 使用 nodemailer 通过 Brevo SMTP 发送交易邮件

import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM || "noreply@gongwenos.182183.xyz";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "公文 OS";

function getTransporter() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[email] BREVO_API_KEY 未配置，邮件功能不可用");
    return null;
  }
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user: apiKey, pass: apiKey },
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  try {
    await transporter.sendMail({ from: `"${FROM_NAME}" <${FROM}>`, to, subject, html });
    return true;
  } catch (err) {
    console.error("[email] 发送失败:", err);
    return false;
  }
}

/** 发送密码重置邮件 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const url = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
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
