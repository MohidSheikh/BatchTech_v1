export const DEFAULT_RECIPIENT_EMAIL = 'batchtechsol@gmail.com';
export const DEFAULT_FROM_EMAIL = 'BatchTech Website <onboarding@resend.dev>';
export const INQUIRY_SUBJECT = 'New Project Inquiry — BatchTech Website';

export interface RawContactInput {
  fullName?: unknown;
  businessEmail?: unknown;
  companyName?: unknown;
  serviceRequired?: unknown;
  projectBudget?: unknown;
  projectDetails?: unknown;
  honeypot?: unknown;
  formRenderedAt?: unknown;
}

export interface NormalizedInquiry {
  fullName: string;
  businessEmail: string;
  companyName: string;
  serviceRequired: string;
  projectBudget: string;
  projectDetails: string;
}

export type ValidationResult =
  | { ok: true; data: NormalizedInquiry }
  | { ok: false; statusCode: number; error: string; isSpam?: boolean };

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim().slice(0, maxLen);
}

function hasHeaderInjection(value: string): boolean {
  return /[\r\n]/.test(value);
}

export function validateAndNormalizeInquiry(
  raw: RawContactInput,
  nowMs: number = Date.now()
): ValidationResult {
  const honeypot = typeof raw.honeypot === 'string' ? raw.honeypot.trim() : '';
  if (honeypot.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Unable to process this submission.',
      isSpam: true,
    };
  }

  if (typeof raw.formRenderedAt === 'number' && Number.isFinite(raw.formRenderedAt)) {
    const elapsed = nowMs - raw.formRenderedAt;
    if (elapsed >= 0 && elapsed < 600) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Please take a moment before submitting your inquiry.',
        isSpam: true,
      };
    }
  }

  const fullName = cleanString(raw.fullName, 120);
  const businessEmail = cleanString(raw.businessEmail, 180);
  const companyName = cleanString(raw.companyName, 180);
  const serviceRequired = cleanString(raw.serviceRequired, 100);
  const projectBudget = cleanString(raw.projectBudget, 80);
  const projectDetails = cleanString(raw.projectDetails, 5000);

  if (!fullName || fullName.length < 2) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please enter your full name.',
    };
  }

  if (!businessEmail || hasHeaderInjection(businessEmail) || !EMAIL_PATTERN.test(businessEmail)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please enter a valid business email address.',
    };
  }

  if (!serviceRequired) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please select the service you require.',
    };
  }

  if (!projectDetails || projectDetails.length < 5) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please enter your project details.',
    };
  }

  return {
    ok: true,
    data: {
      fullName,
      businessEmail,
      companyName,
      serviceRequired,
      projectBudget,
      projectDetails,
    },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatInquiryEmail(
  inquiry: NormalizedInquiry,
  submittedAt: Date = new Date()
): { subject: string; text: string; html: string } {
  const formattedTimestamp = submittedAt.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }) + ' UTC';

  const companyDisplay = inquiry.companyName || 'Not provided';

  const textLines = [
    'New Project Inquiry — BatchTech Website',
    '=========================================',
    '',
    `Full Name:          ${inquiry.fullName}`,
    `Business Email:     ${inquiry.businessEmail}`,
    `Company / Website:  ${companyDisplay}`,
    `Service Required:   ${inquiry.serviceRequired}`,
  ];

  if (inquiry.projectBudget) {
    textLines.push(`Project Budget:     ${inquiry.projectBudget}`);
  }

  textLines.push(
    `Submitted At:       ${formattedTimestamp}`,
    '',
    'Project Details:',
    '----------------',
    inquiry.projectDetails,
    ''
  );

  const budgetRowHtml = inquiry.projectBudget
    ? `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#8D9FB9;font-size:13px;width:170px;vertical-align:top;">Project Budget</td>
        <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#F3F7FF;font-size:14px;">${escapeHtml(inquiry.projectBudget)}</td>
      </tr>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background-color:#080D19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#DCE5F4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background-color:#0D1526;border:1px solid #26344C;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;background-color:#101A2D;border-bottom:1px solid #26344C;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#79A7FF;">BatchTech Website</p>
        <h1 style="margin:0;font-size:20px;line-height:1.25;color:#FFFFFF;font-weight:800;">New Project Inquiry</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#8D9FB9;font-size:13px;width:170px;vertical-align:top;">Full Name</td>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#FFFFFF;font-size:14px;font-weight:600;">${escapeHtml(inquiry.fullName)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#8D9FB9;font-size:13px;width:170px;vertical-align:top;">Business Email</td>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;font-size:14px;"><a href="mailto:${escapeHtml(inquiry.businessEmail)}" style="color:#79A7FF;text-decoration:none;">${escapeHtml(inquiry.businessEmail)}</a></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#8D9FB9;font-size:13px;width:170px;vertical-align:top;">Company / Website</td>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#F3F7FF;font-size:14px;">${escapeHtml(companyDisplay)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#8D9FB9;font-size:13px;width:170px;vertical-align:top;">Service Required</td>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#FFFFFF;font-size:14px;font-weight:600;">${escapeHtml(inquiry.serviceRequired)}</td>
          </tr>${budgetRowHtml}
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#8D9FB9;font-size:13px;width:170px;vertical-align:top;">Submitted At</td>
            <td style="padding:10px 0;border-bottom:1px solid #1E2D45;color:#A9B7CC;font-size:13px;">${escapeHtml(formattedTimestamp)}</td>
          </tr>
        </table>
        <div style="margin-top:22px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#79A7FF;">Project Details</p>
          <div style="padding:16px;background-color:#080D19;border:1px solid #26344C;border-radius:8px;color:#DCE5F4;font-size:14px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(inquiry.projectDetails)}</div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: INQUIRY_SUBJECT,
    text: textLines.join('\n'),
    html,
  };
}

export interface SendInquiryOptions {
  apiKey?: string;
  fromEmail?: string;
  recipientEmail?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  submittedAt?: Date;
}

export type SendInquiryResult =
  | { ok: true; id: string; recipient: string }
  | { ok: false; statusCode: number; code: string; error: string };

export async function sendInquiryEmail(
  inquiry: NormalizedInquiry,
  options: SendInquiryOptions = {}
): Promise<SendInquiryResult> {
  const apiKey = (options.apiKey ?? process.env.RESEND_API_KEY ?? '').trim();
  const fromEmail = (options.fromEmail ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL).trim();
  const recipientEmail = (
    options.recipientEmail ??
    process.env.CONTACT_RECIPIENT_EMAIL ??
    DEFAULT_RECIPIENT_EMAIL
  ).trim();
  const endpoint = options.endpoint ?? 'https://api.resend.com/emails';
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey || apiKey === 'MY_RESEND_API_KEY') {
    return {
      ok: false,
      statusCode: 503,
      code: 'MISSING_API_KEY',
      error: 'Email service credentials are not configured on the server.',
    };
  }

  const formatted = formatInquiryEmail(inquiry, options.submittedAt);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        reply_to: inquiry.businessEmail,
        subject: formatted.subject,
        html: formatted.html,
        text: formatted.text,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok || !payload.id) {
      return {
        ok: false,
        statusCode: 502,
        code: 'UPSTREAM_EMAIL_ERROR',
        error: payload.message || `Email provider rejected the request (${response.status}).`,
      };
    }

    return {
      ok: true,
      id: payload.id,
      recipient: recipientEmail,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 502,
      code: 'NETWORK_ERROR',
      error: err instanceof Error ? err.message : 'Unable to reach email service.',
    };
  }
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 5, windowMs = 15 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string, nowMs: number = Date.now()): { allowed: boolean; remaining: number } {
    const cutoff = nowMs - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0 };
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return { allowed: true, remaining: this.maxRequests - recent.length };
  }
}
