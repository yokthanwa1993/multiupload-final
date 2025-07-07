import fs from 'fs';
import path from 'path';
import FacebookManagerClient from './FacebookManagerClient';

interface FacebookPage {
    id: string;
    name: string;
    access_token: string;
    category: string;
}

async function getFacebookStatus(): Promise<FacebookPage | null> {
  const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
  const TOKEN_PATH = path.join(dataDir, 'facebook-token.json');

  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(tokenData);
    }
  } catch (error) {
    console.error("Could not read facebook-token.json:", error);
  }
  return null;
}

export default async function FacebookPage() {
    const selectedPage = await getFacebookStatus();

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="main-container">
                <div className="glass-container">
                    <FacebookManagerClient initialSelectedPage={selectedPage} />
                </div>
            </div>
        </main>
    );
} 