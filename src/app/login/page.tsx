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
    const [isLoginComplete, setIsLoginComplete] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            setIsLoginComplete(true);
            const timer = setTimeout(() => {
                router.push('/');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, loading, router]);

    const handleGoogleSignIn = async () => {
        if (!auth) {
            alert("Firebase authentication is not available. Please try again later.");
            return;
        }

        setIsLoginComplete(true); // Set to gray immediately after click
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const idToken = await result.user.getIdToken();
            await fetch('/api/auth/session', {
                method: 'POST',
                body: idToken,
            });
            
            router.refresh();
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error("Error during Google sign-in:", error);
            alert("Failed to sign in with Google. Please try again.");
            setIsLoginComplete(false); // Reset button if error
        }
    };

    if (loading) {
        return (
            <div id="preloader">
                <div className="loader"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <button 
                onClick={handleGoogleSignIn} 
                disabled={isLoginComplete}
                className={`btn ${isLoginComplete ? 'btn-success' : 'btn-primary'}`}
                style={isLoginComplete ? {
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    cursor: 'not-allowed',
                    opacity: '0.9'
                } : {}}
            >
                {isLoginComplete ? (
                    <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Login Successful</span>
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>🔐 Continue with Google</span>
                    </>
                )}
            </button>
        </main>
    );
} 