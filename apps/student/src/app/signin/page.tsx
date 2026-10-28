import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInScreen } from '../../components/sign-in-screen';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  // The reason for coming back here (?error=, ?devices=) is read from the query string on the device.
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
