import type { Notification } from '../domain/notification.js';
import type { NotificationProvider, ProviderResult } from '../service/orchestrator.js';

const responseError = async (response: Response): Promise<string> => {
  const body = await response.text();
  return `${response.status} ${body.slice(0, 300)}`;
};

export class ResendEmailProvider implements NotificationProvider {
  readonly name = 'resend';
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(notification: Notification): Promise<ProviderResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [notification.recipient],
        subject: notification.template,
        text: JSON.stringify(notification.data),
      }),
    });
    return response.ok ? { accepted: true, provider: this.name } : { accepted: false, provider: this.name, error: await responseError(response) };
  }
}

export class TwilioSmsProvider implements NotificationProvider {
  readonly name = 'twilio';
  constructor(private readonly accountSid: string, private readonly authToken: string, private readonly from: string) {}

  async send(notification: Notification): Promise<ProviderResult> {
    const body = new URLSearchParams({ To: notification.recipient, From: this.from, Body: `${notification.template}: ${JSON.stringify(notification.data)}` });
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    return response.ok ? { accepted: true, provider: this.name } : { accepted: false, provider: this.name, error: await responseError(response) };
  }
}
