"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            console.log("AuthContext: Firebase auth not initialized");
            setLoading(false);
            return;
        }

        console.log("AuthContext: Subscribing to auth state changes...");
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("AuthContext: onAuthStateChanged fired. User:", user ? user.uid : 'null');
            setUser(user);
            setLoading(false);
            console.log("AuthContext: State updated. Loading is now false.");
        });

        return () => {
            console.log("AuthContext: Unsubscribing from auth state changes.");
            unsubscribe();
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 