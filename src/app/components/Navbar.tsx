"use client";

import { useAuth } from '@/app/context/AuthContext';
import { auth } from '@/app/lib/firebase';
import { signOut } from 'firebase/auth';
import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
    const { user } = useAuth();

    const handleLogout = async () => {
        try {
            // First, sign out from Firebase on the client
            if (auth) {
                await signOut(auth);
            }
            // Then, tell our server to clear the session cookie
            await fetch('/api/auth/session', {
                method: 'DELETE',
            });
            // The onAuthStateChanged listener will then redirect to /login
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    if (!user) {
        return null; // Don't render anything if there's no user
    }

    return (
        <nav className="top-navbar">
            <div className="user-info-container">
                <div className="user-info">
                    {user.photoURL && (
                        <Image 
                            src={user.photoURL} 
                            alt={user.displayName || 'User Avatar'} 
                            width={40} 
                            height={40}
                            className="user-avatar"
                        />
                    )}
                    <span>{user.displayName || 'Welcome'}</span>
                </div>
            </div>
            <div className="navbar-buttons">
                <Link href="/history" className="logout-button">
                    History
                </Link>
                <button onClick={handleLogout} className="logout-button">
                    Logout
                </button>
            </div>
        </nav>
    );
} 