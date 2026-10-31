import { Suspense } from 'react';
import { ListeningApp } from '../../../components/listening-app';

export default function HomePage() {
  // The open tab lives in the query string; Suspense lets the static page render before it is read.
  return (
    <Suspense>
      <ListeningApp />
    </Suspense>
  );
}
