"use client";

import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { useEffect, useState } from 'react';

export default function LoginPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [isSigningIn, setIsSigningIn] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    const handleGoogleSignIn = async () => {
        if (!auth) {
            alert("Firebase authentication is not available. Please try again later.");
            return;
        }

        setIsSigningIn(true);
        const provider = new GoogleAuthProvider();
        try {
            // 1. Sign in
            const result = await signInWithPopup(auth, provider);
            // 2. Get ID token
            const idToken = await result.user.getIdToken();
            // 3. Create session cookie and wait for it
            await fetch('/api/auth/session', {
                method: 'POST',
                body: idToken,
            });
            // 4. Now redirect using a full page navigation to ensure cookie is sent
            window.location.href = '/';

        } catch (error) {
            console.error("Error during Google sign-in:", error);
            alert("Failed to sign in with Google. Please try again.");
            setIsSigningIn(false);
        }
    };

    if (loading || user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <button 
                onClick={handleGoogleSignIn} 
                disabled={isSigningIn}
                className="btn btn-primary text-xl px-8 py-4"
            >
                {isSigningIn ? (
                    <>
                        <div className="loading mr-2"></div>
                        <span>Signing you in...</span>
                    </>
                ) : (
                    <span>🔐 Continue with Google</span>
                )}
            </button>
        </main>
    );
} 