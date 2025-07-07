"use client";

import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from './Navbar';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    console.log("ProtectedRoute rendering...", { loading, user: user?.email });

    useEffect(() => {
        // If loading is finished and there's no user, redirect to login page.
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // While loading, show a loading indicator to prevent flashing protected content.
    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading user session...</p>
            </div>
        );
    }

    // If loading is finished and there is a user, render the Navbar and children.
    return (
        <>
            <Navbar />
            {children}
        </>
    );
} 