import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';
import { loadEnv } from '../config/env.js';

/** The parts of a verified Google ID token the parent sign-in uses. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  azp?: string;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  nonce?: string;
  exp: number;
}

const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_TTL_MS = 60 * 60 * 1000;

const denied = (message: string) => new UnauthorizedException({ code: 'GOOGLE_DENIED', message });
const decode = <T>(part: string): T => JSON.parse(Buffer.from(part, 'base64url').toString()) as T;

/**
 * Exchanges a Google authorization code and verifies the ID token: RS256 signature against Google's keys,
 * issuer, audience (and azp), nonce, expiry and a verified email. Tests replace this provider.
 */
@Injectable()
export class GoogleIdentityVerifier {
  private keys: { fetchedAt: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;

  async identify(code: string, redirectUri: string, nonce: string): Promise<GoogleIdentity> {
    const env = loadEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw denied('Google sign-in is not set up');
    const exchange = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!exchange.ok) throw denied('Google did not accept the sign-in code');
    const { id_token: idToken } = (await exchange.json()) as { id_token?: string };
    if (!idToken) throw denied('Google returned no identity');
    const claims = await this.verifySignature(idToken);
    return checkClaims(claims, env.GOOGLE_CLIENT_ID, nonce);
  }

  private async verifySignature(token: string): Promise<IdTokenClaims> {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) throw denied('Malformed identity token');
    const { alg, kid } = decode<{ alg: string; kid?: string }>(header);
    if (alg !== 'RS256' || !kid) throw denied('Unexpected identity token algorithm');
    const key = (await this.signingKeys(kid)).find((candidate) => candidate.kid === kid);
    const valid =
      key &&
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        createPublicKey({ key, format: 'jwk' }),
        Buffer.from(signature, 'base64url'),
      );
    if (!valid) throw denied('Identity token signature is not valid');
    return decode<IdTokenClaims>(payload);
  }

  /** Google's keys, cached for an hour and refetched when a token names an unknown key. */
  private async signingKeys(kid: string): Promise<(JsonWebKey & { kid?: string })[]> {
    const fresh = this.keys && Date.now() - this.keys.fetchedAt < JWKS_TTL_MS;
    if (!fresh || !this.keys!.keys.some((key) => key.kid === kid)) {
      const response = await fetch(JWKS_URL);
      if (!response.ok) throw denied('Could not reach Google');
      this.keys = { fetchedAt: Date.now(), keys: ((await response.json()) as { keys: [] }).keys };
    }
    return this.keys!.keys;
  }
}

/** Claim checks shared by the real verifier and its test double. */
export function checkClaims(claims: IdTokenClaims, clientId: string, nonce: string): GoogleIdentity {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const ok =
    ISSUERS.includes(claims.iss) &&
    audiences.includes(clientId) &&
    (audiences.length === 1 || claims.azp === clientId) &&
    claims.nonce === nonce &&
    Number.isFinite(claims.exp) &&
    claims.exp * 1000 > Date.now();
  if (!ok) throw denied('Identity token claims are not valid');
  if (!claims.sub || !claims.email || (claims.email_verified !== true && claims.email_verified !== 'true'))
    throw denied('The Google account has no verified email');
  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: claims.name?.trim().slice(0, 120) ?? '',
  };
}
