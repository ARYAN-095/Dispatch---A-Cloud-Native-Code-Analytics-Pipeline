import { useState, useEffect } from 'react';
import { 
    GithubAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase'; // <-- Make sure to import 'db'
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { BarChart3, Github, LogIn, LogOut, Loader, CheckCircle, AlertTriangle } from 'lucide-react';

// --- Data Type for our Job ---
// It's good practice to define the shape of your data
interface Job {
    id: string;
    userId: string;
    repoUrl: string;
    status: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    report?: any; // We'll define the report structure later
}

// Main Application Component
export default function App() {
    // --- State Management ---
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]); // <-- State to hold our jobs from Firestore
    const [repoUrl, setRepoUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // --- Authentication State Listener ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- NEW: Firestore Real-time Data Listener ---
    useEffect(() => {
        // If there's no user, we don't fetch anything.
        if (!user) {
            setJobs([]); // Clear jobs if user logs out
            return;
        }

        // Create a query to get jobs only for the current user.
        const jobsCollection = collection(db, 'jobs');
        const q = query(jobsCollection, where('userId', '==', user.uid));

        // onSnapshot sets up a real-time listener.
        // This function will run every time the data matching the query changes.
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jobsData: Job[] = [];
            querySnapshot.forEach((doc) => {
                jobsData.push({ id: doc.id, ...doc.data() } as Job);
            });
            
            // Sort jobs by creation date, newest first
            jobsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

            setJobs(jobsData);
        }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError("Could not fetch analysis jobs.");
        });

        // Return the unsubscribe function to clean up the listener when the component unmounts
        return () => unsubscribe();

    }, [user]); // This effect re-runs whenever the 'user' object changes.

    // --- UPDATED: Job Submission Handler ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!repoUrl.trim()) {
            setError("Please enter a GitHub repository URL.");
            return;
        }
        if (!user) {
            setError("You must be signed in to submit a job.");
            return;
        }

        setIsSubmitting(true);

        try {
            // This now sends the request to our Node.js API Gateway
            const response = await fetch('http://localhost:8080/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repoUrl: repoUrl,
                    userId: user.uid, // Send the user's unique ID
                }),
            });

            if (!response.ok) {
                // Handle cases where the API returns an error
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to submit job to API.');
            }
            
            // If successful, clear the input field
            setRepoUrl('');

        } catch (err) {
            console.error("Submission error:", err);
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Authentication Handlers (unchanged) ---
    const handleSignIn = async () => { /* ... same as before ... */ };
    const handleSignOut = async () => { /* ... same as before ... */ };
    
    // --- UI Components ---
    const Header = () => (
        <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center">
            {/* ... same as before ... */}
        </header>
    );

    const RepoInputForm = () => (
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <form onSubmit={handleSubmit}>
                <label htmlFor="repo-url" className="block text-lg font-medium text-white mb-2">Analyze a GitHub Repository</label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                        id="repo-url"
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="e.g., https://github.com/facebook/react"
                        className="flex-grow p-3 bg-gray-900 text-white border-2 border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        disabled={isSubmitting}
                    />
                    <button type="submit" className="flex justify-center items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed" disabled={isSubmitting}>
                        {isSubmitting ? <Loader className="animate-spin" size={24} /> : 'Analyze'}
                    </button>
                </div>
                {error && <p className="text-red-400 mt-2">{error}</p>}
            </form>
        </div>
    );

    // --- NEW: Dynamic Status Icon ---
    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case 'Complete': return <CheckCircle className="text-green-400" />;
            case 'Error': return <AlertTriangle className="text-red-400" />;
            default: return <Loader className="text-indigo-400 animate-spin" />;
        }
    };

    // --- UPDATED: Analysis List ---
    const AnalysisList = () => (
        <div className="mt-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Analysis History</h2>
            <div className="space-y-3">
                {jobs.length > 0 ? jobs.map(job => (
                    <div key={job.id} className={`p-4 bg-gray-800 rounded-lg flex items-center justify-between shadow-md transition-all`}>
                        <div className="flex items-center space-x-4">
                            <StatusIcon status={job.status} />
                            <div>
                                <p className="font-semibold text-white">{job.repoUrl.split('/').slice(-2).join('/')}</p>
                                <p className="text-sm text-gray-400">{job.status}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500">{job.createdAt ? new Date(job.createdAt.toDate()).toLocaleString() : 'Just now'}</p>
                    </div>
                )) : (
                    <p className="text-gray-400 text-center py-8">No analysis jobs yet. Submit a repository to get started.</p>
                )}
            </div>
        </div>
    );

    // --- Main Render Logic (unchanged) ---
    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans">
            <Header />
            <main className="max-w-4xl mx-auto p-4 md:p-8">
                {loading ? (
                    <div className="text-center p-16"><Loader className="mx-auto animate-spin text-indigo-400" size={48} /></div>
                ) : user ? (
                    <>
                        <RepoInputForm />
                        <AnalysisList />
                    </>
                ) : (
                    <div className="text-center bg-gray-800 p-12 rounded-lg shadow-lg mt-16">
                        {/* ... Sign in screen same as before ... */}
                    </div>
                )}
            </main>
        </div>
    );
}
