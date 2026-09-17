import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
const [projectId, uid, operation] = process.argv.slice(2);
if (!projectId || !uid || !['grant', 'revoke'].includes(operation)) {
  throw new Error('Usage: npm run admin:grant -- PROJECT_ID USER_UID grant|revoke');
}
initializeApp({ projectId, credential: applicationDefault() });
const auth = getAuth();
const user = await auth.getUser(uid);
const claims = { ...user.customClaims };
if (operation === 'grant') claims.newsAdmin = true;
else delete claims.newsAdmin;
await auth.setCustomUserClaims(uid, claims);
if (operation === 'revoke') await auth.revokeRefreshTokens(uid);
console.log(`News permission ${operation} completed for ${uid}. Sign out and sign back in to refresh access.`);
