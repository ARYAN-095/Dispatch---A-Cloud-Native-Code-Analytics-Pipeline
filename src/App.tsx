// --- FIX ---
// Removed 'React' from the import as it's no longer needed in modern React versions
// and was causing the production build to fail.
import { useState, useEffect } from 'react';
// --- END FIX ---
import { 
    GithubAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import { BarChart3, Github, LogIn, LogOut, Loader } from 'lucide-react';

// Main Application Component
export default function App() {
    // --- State Management ---
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // --- Authentication State Listener ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Event Handlers ---
    const handleSignIn = async () => {
        const provider = new GithubAuthProvider();
        try {
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
    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans">
            <Header />
            <main className="max-w-4xl mx-auto p-4 md:p-8">
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
