"use client";

import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import Navbar from './Navbar';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Redirect if loading is finished and there's no user.
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);
    
    // If there is no authenticated user, render nothing while the redirect happens.
    // This also covers the initial loading state gracefully without a full-page loader.
    if (!user) {
        return null;
    }

    // If we have a user, render the content.
    return (
        <>
            <Navbar />
            {children}
        </>
    );
} 