import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Logo } from '../components/Logo';

export const Invitations = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const action = searchParams.get('action');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Processing invitation...');
    const navigate = useNavigate();

    useEffect(() => {
        if (!token || !action) {
            setStatus('error');
            setMessage('Invalid invitation link');
            return;
        }

        const processInvitation = async () => {
            try {
                if (action === 'accept') {
                    await api.post('/users/invitations/accept', { token });
                    setStatus('success');
                    setMessage('Invitation accepted! You can now log in or sign up with Google.');
                } else if (action === 'reject') {
                    await api.post('/users/invitations/reject', { token });
                    setStatus('success');
                    setMessage('Invitation rejected.');
                } else {
                    setStatus('error');
                    setMessage('Invalid action');
                }
            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Failed to process invitation');
            }
        };

        processInvitation();
    }, [token, action]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-bg)'
        }}>
            <div className="card flex flex-col items-center" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                    <Logo />
                </div>

                <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Invitation Status</h1>

                <div style={{
                    padding: '1rem',
                    width: '100%',
                    backgroundColor: status === 'loading' ? '#f3f4f6' : status === 'success' ? '#f0fdf4' : '#fee2e2',
                    color: status === 'loading' ? '#4b5563' : status === 'success' ? '#166534' : '#ef4444',
                    border: '1px solid',
                    borderColor: status === 'loading' ? '#e5e7eb' : status === 'success' ? '#bbf7d0' : '#fecaca',
                    borderRadius: '0.5rem',
                    marginBottom: '2rem'
                }}>
                    {message}
                </div>

                {status !== 'loading' && (
                    <button
                        onClick={() => navigate('/login')}
                        className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow active:scale-95 w-full flex items-center justify-center gap-2"
                    >
                        Go to Login
                    </button>
                )}
            </div>
        </div>
    );
};
