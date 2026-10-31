/** The language a visitor picked on the landing page ('vi' | 'en'). */
export const LANG_KEY = 'la-landing-lang';
/** Set by the app while a parent or staff user is signed in on this device. */
export const SIGNED_IN_KEY = 'la-signed-in';

/**
 * Runs in the landing page's <head>, before it paints: a device that is signed in goes straight to the app, and a
 * visitor who chose English earlier goes from / to /en. (Parent cookies live on the API host, so the server cannot
 * tell who is signed in.)
 */
export const LANDING_SCRIPT = `try{var s=localStorage;if(s.getItem('${SIGNED_IN_KEY}')==='1')location.replace('/app');else if(location.pathname==='/'&&s.getItem('${LANG_KEY}')==='en')location.replace('/en')}catch(e){}`;
