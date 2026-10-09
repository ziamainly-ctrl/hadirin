import { describe, it, expect } from 'vitest';
import { maskEmail, maskPhone, maskRecipient } from '../lib/insights/mask';
import { describeNotificationFailure } from '../lib/insights/notification-failure';

describe('lib/insights/mask', () => {
  it('maskEmail keeps the first letter and the domain', () => {
    expect(maskEmail('hendra@kliniksentosa.test')).toBe('h*****@kliniksentosa.test');
    expect(maskEmail('dewi@kliniksentosa.test')).toBe('d***@kliniksentosa.test');
    expect(maskEmail('a@x.id')).toBe('*@x.id');
  });

  it('maskEmail hides malformed input completely', () => {
    expect(maskEmail('')).toBe('***');
    expect(maskEmail(null)).toBe('***');
    expect(maskEmail('no-at-sign')).toBe('***');
    expect(maskEmail('@domain.id')).toBe('***');
    expect(maskEmail('name@')).toBe('***');
  });

  it('maskPhone keeps the first 5 and the last 3 characters', () => {
    expect(maskPhone('+6281200000001')).toBe('+6281******001');
    expect(maskPhone('+62 812 0000 0003')).toBe('+6281******003');
  });

  it('maskPhone hides short or missing numbers completely', () => {
    expect(maskPhone('0812')).toBe('***');
    expect(maskPhone('')).toBe('***');
    expect(maskPhone(undefined)).toBe('***');
  });

  it('maskRecipient picks the mask by channel', () => {
    expect(maskRecipient('EMAIL', 'bambang@kliniksentosa.test')).toBe('b*****@kliniksentosa.test');
    expect(maskRecipient('WHATSAPP', '+6281200000003')).toBe('+6281******003');
    expect(maskRecipient('SMS', '+6281200000003')).toBe('***');
  });
});

describe('lib/insights/notification-failure', () => {
  it('never returns the raw error text', () => {
    const raw = 'connect ECONNREFUSED 127.0.0.1:587';
    const failure = describeNotificationFailure(raw);
    expect(failure.reason).toBe('Layanan pengiriman tidak dapat dihubungi');
    expect(JSON.stringify(failure)).not.toContain('127.0.0.1');
    expect(JSON.stringify(failure)).not.toContain('587');
  });

  it('recognises the seed WhatsApp failure', () => {
    expect(describeNotificationFailure('Recipient number is not registered on WhatsApp').reason).toBe('Nomor penerima tidak valid');
  });

  it('falls back for unknown or empty errors', () => {
    expect(describeNotificationFailure(null).reason).toBe('Pengiriman gagal');
    expect(describeNotificationFailure('something odd').reason).toBe('Pengiriman gagal');
  });
});
