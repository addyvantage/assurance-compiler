import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { bearer, deviceAuthorization } from 'better-auth/plugins';
import { db, schema } from './db';

/** Device codes a CLI may hold before the user approves them. */
export const DEVICE_CODE_LIFETIME = '10m';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      deviceCode: schema.deviceCode,
    },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    // The CLI obtains its session through the device flow and presents it as a bearer token.
    deviceAuthorization({
      verificationUri: '/device',
      expiresIn: DEVICE_CODE_LIFETIME,
      interval: '5s',
    }),
    bearer(),
    nextCookies(),
  ],
});
