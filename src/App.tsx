import { useState, useEffect } from 'react';
import { 
    GithubAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { 
    BarChart3, Github, LogIn, LogOut, Loader, CheckCircle, AlertTriangle, X,
    FileText, ShieldCheck, ExternalLink
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Data Type Definitions ---
interface Job {
    id: string;
    userId: string;
    repoUrl: string;
    repoName?: string;
    status: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    errorDetails?: string;
    report?: {
        security?: {
            vulnerabilitiesFound: number;
            details: { id: string; severity: string; package: string }[];
        };
        complexity?: {
            cyclomatic: number;
            maintainability: number;
        };
    };
}

// Main Application Component
export default function App() {
    // --- State Management ---
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [repoUrl, setRepoUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    // --- Authentication Listener ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Firestore Real-time Data Listener ---
    useEffect(() => {
        if (!user) {
            setJobs([]);
            return;
        }
        const q = query(collection(db, 'jobs'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jobsData: Job[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // --- FIX 1: Robust Repo Name Parsing ---
                // This will not crash if the repoUrl is malformed.
                let repoName = data.repoUrl;
                try {
                    const path = new URL(data.repoUrl).pathname;
                    repoName = path.startsWith('/') ? path.substring(1) : path;
                } catch (e) {
                    // Keep the original URL if parsing fails
                    console.warn(`Could not parse URL: ${data.repoUrl}`);
                }

                jobsData.push({ id: doc.id, ...data, repoName } as Job);
            });

            // --- FIX 2: Safe Sorting ---
            // This prevents errors if createdAt is temporarily null.
            jobsData.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });

            setJobs(jobsData);
        }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError("Could not fetch analysis jobs.");
        });
        return () => unsubscribe();
    }, [user]);

    // --- Job Submission Handler ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!repoUrl.trim() || !user) return;
        setIsSubmitting(true);
        try {
            const response = await fetch('http://localhost:8080/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl: repoUrl, userId: user.uid }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to submit job.');
            }
            setRepoUrl('');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // --- Authentication Handlers ---
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
                        <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-indigo-400" />
                        <span className="text-white hidden sm:block">{user.displayName}</span>
                        <button onClick={handleSignOut} className="p-2 rounded-md bg-gray-700 hover:bg-indigo-500 text-white transition-colors" aria-label="Sign Out">
                            <LogOut size={20} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );

    const RepoInputForm = () => (
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <form onSubmit={handleSubmit}>
                <label htmlFor="repo-url" className="block text-lg font-medium text-white mb-2">Analyze a GitHub Repository</label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <input id="repo-url" type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="e.g., https://github.com/facebook/react" className="flex-grow p-3 bg-gray-900 text-white border-2 border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" disabled={isSubmitting} />
                    <button type="submit" className="flex justify-center items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed" disabled={isSubmitting}>
                        {isSubmitting ? <Loader className="animate-spin" size={24} /> : 'Analyze'}
                    </button>
                </div>
                {error && <p className="text-red-400 mt-2">{error}</p>}
            </form>
        </div>
    );

    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case 'Complete': return <CheckCircle className="text-green-400" />;
            case 'Error': return <AlertTriangle className="text-red-400" />;
            default: return <Loader className="text-indigo-400 animate-spin" />;
        }
    };

    const AnalysisList = () => (
        <div className="mt-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Analysis History</h2>
            <div className="space-y-3">
                {jobs.length > 0 ? jobs.map(job => (
                    <div key={job.id} onClick={() => job.status === 'Complete' && setSelectedJob(job)} className={`p-4 bg-gray-800 rounded-lg flex items-center justify-between shadow-md transition-all ${job.status === 'Complete' ? 'cursor-pointer hover:bg-gray-700 hover:ring-2 hover:ring-indigo-500' : 'opacity-80'}`}>
                        <div className="flex items-center space-x-4 overflow-hidden">
                            <StatusIcon status={job.status} />
                            <div className="flex-grow overflow-hidden">
                                <p className="font-semibold text-white truncate">{job.repoName || job.repoUrl}</p>
                                <p className="text-sm text-gray-400">{job.status}</p>
                                {job.status === 'Error' && <p className="text-xs text-red-400 mt-1 truncate">{job.errorDetails}</p>}
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 flex-shrink-0 ml-4">{job.createdAt ? new Date(job.createdAt.toDate()).toLocaleString() : 'Just now'}</p>
                    </div>
                )) : (
                    <p className="text-gray-400 text-center py-8">No analysis jobs yet. Submit a repository to get started.</p>
                )}
            </div>
        </div>
    );

    const ReportModal = () => { /* ... same as before ... */ };
    
    const SignInScreen = () => (
        <div className="text-center bg-gray-800 p-12 rounded-lg shadow-lg mt-16">
            <Github className="mx-auto text-gray-500" size={64} />
            <h2 className="mt-4 text-2xl font-bold">Welcome to Dispatch</h2>
            <p className="mt-2 text-gray-400">Sign in with your GitHub account to analyze repositories.</p>
            <button onClick={handleSignIn} className="mt-6 flex items-center space-x-2 mx-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                <LogIn size={20} />
                <span>Sign In with GitHub</span>
            </button>
        </div>
    );

    // --- Main Render Logic ---
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
                    <SignInScreen />
                )}
            </main>
            {/* I've left the ReportModal code out for brevity, but it's the same as the previous version */}
            {selectedJob && <ReportModal />} 
        </div>
    );
}


 