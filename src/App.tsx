import React, { useState, useEffect } from 'react';
import { 
    GithubAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
} from 'firebase/auth';
// --- FIX ---
// We are importing 'User' as a type, which is the correct way to do it
// and avoids the error you encountered.
import type { User } from 'firebase/auth';
// --- END FIX ---
import { auth } from './firebase'; // <-- Importing the auth service we configured
import { BarChart3, Github, LogIn, LogOut, Loader } from 'lucide-react';

// Main Application Component
export default function App() {
    // --- State Management ---
    // 'user' will hold the authenticated user object from Firebase, or null if not logged in.
    const [user, setUser] = useState<User | null>(null);
    // 'loading' will be true while we're checking the initial authentication state.
    const [loading, setLoading] = useState(true);

    // --- Authentication State Listener ---
    // This effect runs once when the component mounts. It sets up a listener
    // to Firebase's auth state. This is the standard way to manage user sessions.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false); // We've checked the auth state, so we can stop loading.
        });

        // Cleanup function: Unsubscribe from the listener when the component unmounts
        // to prevent memory leaks.
        return () => unsubscribe();
    }, []); // The empty dependency array means this effect runs only once.

    // --- Event Handlers ---
    const handleSignIn = async () => {
        const provider = new GithubAuthProvider();
        try {
            // This will trigger the GitHub sign-in popup.
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with GitHub:", error);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // --- UI Components ---
    // It's good practice to break down the UI into smaller components.
    
    const Header = () => (
        <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <BarChart3 className="text-indigo-400" size={32} />
                <h1 className="text-2xl font-bold text-white tracking-tight">Dispatch</h1>
            </div>
            <div>
                {user && (
                    <div className="flex items-center space-x-4">
                        <img 
                            src={user.photoURL || ''} 
                            alt={user.displayName || 'User Avatar'} 
                            className="w-10 h-10 rounded-full border-2 border-indigo-400" 
                        />
                        <span className="text-white hidden sm:block">{user.displayName}</span>
                        <button 
                            onClick={handleSignOut} 
                            className="p-2 rounded-md bg-gray-700 hover:bg-indigo-500 text-white transition-colors"
                            aria-label="Sign Out"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );

    const SignInScreen = () => (
        <div className="text-center bg-gray-800 p-12 rounded-lg shadow-lg mt-16">
            <Github className="mx-auto text-gray-500" size={64} />
            <h2 className="mt-4 text-2xl font-bold">Welcome to Dispatch</h2>
            <p className="mt-2 text-gray-400">Sign in with your GitHub account to analyze repositories.</p>
            <button 
                onClick={handleSignIn} 
                className="mt-6 flex items-center space-x-2 mx-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
            >
                <LogIn size={20} />
                <span>Sign In with GitHub</span>
            </button>
        </div>
    );
    
    const Dashboard = () => (
        <div>
            <div className="p-6 mt-8 bg-gray-800 rounded-lg shadow-lg">
                 <h2 className="text-xl font-semibold text-white">Your Dashboard</h2>
                 <p className="text-gray-400 mt-2">
                     This is where your repository analysis jobs will appear.
                     We'll build this out in the next phase.
                 </p>
            </div>
        </div>
    );

    // --- Main Render Logic ---
    // This is the root of our application's UI.
    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans">
            <Header />
            <main className="max-w-4xl mx-auto p-4 md:p-8">
                {/* This is the core conditional rendering logic:
                  1. If 'loading', show a spinner.
                  2. If not 'loading' and 'user' exists, show the dashboard.
                  3. If not 'loading' and 'user' is null, show the sign-in screen.
                */}
                {loading ? (
                    <div className="text-center p-16">
                        <Loader className="mx-auto animate-spin text-indigo-400" size={48} />
                    </div>
                ) : user ? (
                    <Dashboard />
                ) : (
                <SignInScreen />
                )}
            </main>
        </div>
    );
}
