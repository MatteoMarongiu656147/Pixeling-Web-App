/** Declares Pixeling's public Vite configuration variables. 
 * In this case, this only includes the vapid key for push notifications
 * as it is the only configuration variable in .env.local.
*/
interface ImportMetaEnv {
  readonly VITE_FIREBASE_VAPID_KEY?: string;
}
