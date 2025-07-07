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
            // 4. Now redirect
            router.push('/');

        } catch (error) {
            console.error("Error during Google sign-in:", error);
            alert("Failed to sign in with Google. Please try again.");
            setIsSigningIn(false);
        }
    };

    if (loading || user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="main-container">
                <div className="glass-container text-center p-12">
                    <h1 className="app-title mb-4">Welcome</h1>
                    <p className="app-subtitle mb-8">Please sign in to continue.</p>
                    <button 
                        onClick={handleGoogleSignIn} 
                        className="btn btn-primary w-full max-w-sm mx-auto"
                        disabled={isSigningIn}
                    >
                        {isSigningIn ? 'Signing In...' : 'Sign in with Google'}
                    </button>
                </div>
            </div>
        </main>
    );
} 