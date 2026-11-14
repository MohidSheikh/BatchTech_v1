import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RECIPIENT_EMAIL,
  INQUIRY_SUBJECT,
  SlidingWindowRateLimiter,
  formatInquiryEmail,
  sendInquiryEmail,
  validateAndNormalizeInquiry,
} from './contactEmail.ts';

test('validateAndNormalizeInquiry accepts valid input and trims whitespace', () => {
  const result = validateAndNormalizeInquiry(
    {
      fullName: '  Ayesha Khan ',
      businessEmail: ' ayesha@studio.example ',
      companyName: '  https://studio.example ',
      serviceRequired: 'Web Development',
      projectDetails: '  We need a fast company website with automated lead routing. ',
      honeypot: '',
      formRenderedAt: 1000,
    },
    5000
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.fullName, 'Ayesha Khan');
    assert.equal(result.data.businessEmail, 'ayesha@studio.example');
    assert.equal(result.data.companyName, 'https://studio.example');
    assert.equal(result.data.serviceRequired, 'Web Development');
    assert.equal(result.data.projectBudget, '');
    assert.match(result.data.projectDetails, /automated lead routing/);
  }
});

test('validateAndNormalizeInquiry rejects empty whitespace, invalid email, and header injection', () => {
  const emptyName = validateAndNormalizeInquiry({
    fullName: '   ',
    businessEmail: 'test@example.com',
    serviceRequired: 'Web Development',
    projectDetails: 'Valid details here',
  });
  assert.equal(emptyName.ok, false);

  const badEmail = validateAndNormalizeInquiry({
    fullName: 'Bilal Ahmed',
    businessEmail: 'not-an-email',
    serviceRequired: 'Web Development',
    projectDetails: 'Valid details here',
  });
  assert.equal(badEmail.ok, false);

  const injectedEmail = validateAndNormalizeInquiry({
    fullName: 'Bilal Ahmed',
    businessEmail: 'user@example.com\r\nBcc: evil@example.com',
    serviceRequired: 'Web Development',
    projectDetails: 'Valid details here',
  });
  assert.equal(injectedEmail.ok, false);
});

test('validateAndNormalizeInquiry blocks honeypot spam and instant bot submissions', () => {
  const honeypotHit = validateAndNormalizeInquiry({
    fullName: 'Bot',
    businessEmail: 'bot@example.com',
    serviceRequired: 'Web Development',
    projectDetails: 'Automated message',
    honeypot: 'http://spam.example',
  });
  assert.equal(honeypotHit.ok, false);
  if (!honeypotHit.ok) {
    assert.equal(honeypotHit.isSpam, true);
  }

  const instantSubmit = validateAndNormalizeInquiry(
    {
      fullName: 'Bot User',
      businessEmail: 'bot@example.com',
      serviceRequired: 'Web Development',
      projectDetails: 'Automated message',
      formRenderedAt: 10000,
    },
    10200
  );
  assert.equal(instantSubmit.ok, false);
  if (!instantSubmit.ok) {
    assert.equal(instantSubmit.isSpam, true);
  }
});

test('formatInquiryEmail creates required subject, escapes HTML, and supports optional budget', () => {
  const date = new Date('2026-11-13T18:30:00.000Z');
  const formatted = formatInquiryEmail(
    {
      fullName: 'Sara <Founder>',
      businessEmail: 'sara@company.com',
      companyName: 'Northwind Systems',
      serviceRequired: 'AI & Automation',
      projectBudget: '$5,000 - $10,000',
      projectDetails: 'Connect CRM & automate onboarding <script>alert(1)</script>.',
    },
    date
  );

  assert.equal(formatted.subject, INQUIRY_SUBJECT);
  assert.match(formatted.text, /Full Name:\s+Sara <Founder>/);
  assert.match(formatted.text, /Business Email:\s+sara@company\.com/);
  assert.match(formatted.text, /Company \/ Website:\s+Northwind Systems/);
  assert.match(formatted.text, /Service Required:\s+AI & Automation/);
  assert.match(formatted.text, /Project Budget:\s+\$5,000 - \$10,000/);
  assert.match(formatted.text, /2026/);
  assert.ok(!formatted.html.includes('<script>'));
  assert.ok(formatted.html.includes('&lt;script&gt;'));
});

test('sendInquiryEmail fails cleanly without faking success when RESEND_API_KEY is missing', async () => {
  const result = await sendInquiryEmail(
    {
      fullName: 'Omar Farooq',
      businessEmail: 'omar@client.com',
      companyName: 'Client Co',
      serviceRequired: 'Web Development',
      projectBudget: '',
      projectDetails: 'Need a new marketing platform.',
    },
    { apiKey: '' }
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 503);
    assert.equal(result.code, 'MISSING_API_KEY');
  }
});

test('sendInquiryEmail sends properly structured Resend payload to batchtechsol@gmail.com with visitor Reply-To', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ id: 'email_12345' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await sendInquiryEmail(
    {
      fullName: 'Zainab Tariq',
      businessEmail: 'zainab@acme.io',
      companyName: 'Acme Labs',
      serviceRequired: 'E-commerce Solutions',
      projectBudget: '',
      projectDetails: 'Launching a direct-to-consumer storefront.',
    },
    {
      apiKey: 're_test_key_123',
      fetchImpl: mockFetch,
      submittedAt: new Date('2026-11-13T18:30:00.000Z'),
    }
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.id, 'email_12345');
    assert.equal(result.recipient, DEFAULT_RECIPIENT_EMAIL);
  }

  assert.equal(capturedUrl, 'https://api.resend.com/emails');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer re_test_key_123');

  const body = JSON.parse(String(capturedInit?.body));
  assert.deepEqual(body.to, ['batchtechsol@gmail.com']);
  assert.equal(body.reply_to, 'zainab@acme.io');
  assert.notEqual(body.from, 'zainab@acme.io');
  assert.equal(body.subject, 'New Project Inquiry — BatchTech Website');
  assert.match(body.text, /Zainab Tariq/);
  assert.match(body.html, /Acme Labs/);
});

test('SlidingWindowRateLimiter enforces request caps cleanly', () => {
  const limiter = new SlidingWindowRateLimiter(2, 60_000);
  assert.equal(limiter.check('1.2.3.4', 1000).allowed, true);
  assert.equal(limiter.check('1.2.3.4', 2000).allowed, true);
  assert.equal(limiter.check('1.2.3.4', 3000).allowed, false);
  assert.equal(limiter.check('1.2.3.4', 65_000).allowed, true);
});
