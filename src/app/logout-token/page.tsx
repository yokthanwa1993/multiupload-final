import fs from 'fs';
import path from 'path';
import LogoutClient from './LogoutClient';

// We can reuse the status checking logic. Ideally, this would be in a shared lib.
async function getYoutubeStatus(): Promise<boolean> {
  const tokenPath = path.join(process.cwd(), 'token.json');
  if (!fs.existsSync(tokenPath)) return false;
  // A more robust check could validate the token here, but for now, file existence is enough.
  return true;
}

async function getFacebookStatus(): Promise<boolean> {
  const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
  const TOKEN_PATH = path.join(dataDir, 'facebook-token.json');
  if (!fs.existsSync(TOKEN_PATH)) return false;
  return true;
}


export default async function LogoutPage() {
    const youtubeStatus = await getYoutubeStatus();
    const facebookStatus = await getFacebookStatus();

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="main-container">
                <div className="glass-container">
                    <LogoutClient 
                        initialYoutubeStatus={youtubeStatus}
                        initialFacebookStatus={facebookStatus}
                    />
                </div>
            </div>
        </main>
    );
} 