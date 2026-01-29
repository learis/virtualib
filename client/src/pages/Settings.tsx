import { useState, useEffect, useRef } from 'react';
import { Save, Mail, Bell } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface LibrarySettings {
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    smtp_from: string;
    // Gmail
    email_provider: 'smtp' | 'gmail';
    gmail_user?: string;
    gmail_client_id?: string;
    gmail_client_secret?: string;
    gmail_refresh_token?: string;

    overdue_days: number;
    email_templates?: {
        overdue?: {
            subject: string;
            body: string;
        };
    };
}

export const Settings = () => {
    const [settings, setSettings] = useState<LibrarySettings>({
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        smtp_from: '',
        email_provider: 'smtp',
        overdue_days: 14
    });
    const [isLoading, setIsLoading] = useState(false);
    const [activeField, setActiveField] = useState<'subject' | 'body' | null>(null);
    const user = useAuthStore(state => state.user);

    const subjectInputRef = useRef<HTMLInputElement>(null);
    const bodyInputRef = useRef<HTMLTextAreaElement>(null);

    const insertVariable = (variable: string) => {
        const currentTemplates = (settings.email_templates as any) || {};
        const overdue = currentTemplates.overdue || {};

        let input: HTMLInputElement | HTMLTextAreaElement | null = null;
        let currentValue = '';
        let fieldKey = '';

        if (activeField === 'subject') {
            input = subjectInputRef.current;
            currentValue = overdue.subject || '';
            fieldKey = 'subject';
        } else if (activeField === 'body') {
            input = bodyInputRef.current;
            currentValue = overdue.body || '';
            fieldKey = 'body';
        }

        if (input && fieldKey) {
            const start = input.selectionStart || currentValue.length;
            const end = input.selectionEnd || currentValue.length;
            const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
            const newCursorPos = start + variable.length;

            setSettings({
                ...settings,
                email_templates: {
                    ...currentTemplates,
                    overdue: { ...overdue, [fieldKey]: newValue }
                }
            });

            setTimeout(() => {
                if (input) {
                    input.focus();
                    input.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/settings');
                if (res.data) {
                    const sanitized = {
                        ...res.data,
                        smtp_host: res.data.smtp_host || '',
                        smtp_port: res.data.smtp_port || 587,
                        smtp_user: res.data.smtp_user || '',
                        smtp_pass: res.data.smtp_password || '',
                        email_provider: res.data.email_provider || 'smtp',
                    };

                    setSettings({
                        ...sanitized,
                        smtp_pass: res.data.smtp_password || '',
                        gmail_user: res.data.gmail_user || '',
                        gmail_client_id: res.data.gmail_client_id || '',
                        gmail_client_secret: res.data.gmail_client_secret || '',
                        gmail_refresh_token: res.data.gmail_refresh_token || '',
                    });
                }
            } catch (error) {
                console.error('Failed to fetch settings');
            }
        };
        if (user?.role === 'admin') fetchSettings();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const payload = {
                ...settings,
                smtp_password: settings.smtp_pass
            };
            await api.put('/settings', payload);
            alert('Settings updated successfully');
        } catch (error: any) {
            console.error(error);
            const message = error.response?.data?.message || 'Failed to update settings';
            alert(`${message} `);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNumberChange = (field: keyof LibrarySettings, value: string) => {
        const parsed = parseInt(value);
        setSettings({ ...settings, [field]: isNaN(parsed) ? 0 : parsed });
    };

    if (user?.role !== 'admin') {
        return <div className="p-8 text-center text-gray-500">Access denied. Admin only.</div>;
    }

    const availableVariables = [
        { label: 'User Name', value: '{user}' },
        { label: 'Book Title', value: '{book}' },
        { label: 'Author', value: '{author}' },
        { label: 'Publisher', value: '{publisher}' },
        { label: 'Due Date', value: '{date}' },
        { label: 'Borrow Date', value: '{borrow_date}' },
        { label: 'Days Late', value: '{days_late}' },
    ];

    return (
        <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
            <h1 className="text-2xl font-bold mb-6">Library Settings</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Settings */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-4 text-purple-700">
                        <Mail size={20} />
                        <h2 className="text-lg font-semibold">SMTP Configuration</h2>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg mb-6 w-fit">
                        <button
                            type="button"
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settings.email_provider === 'smtp' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setSettings({ ...settings, email_provider: 'smtp' })}
                        >
                            SMTP Server
                        </button>
                        <button
                            type="button"
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settings.email_provider === 'gmail' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setSettings({ ...settings, email_provider: 'gmail' })}
                        >
                            Gmail API (HTTP)
                        </button>
                    </div>

                    {settings.email_provider === 'smtp' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">SMTP Host</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={settings.smtp_host}
                                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                                    placeholder="smtp.gmail.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Port</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={settings.smtp_port}
                                    onChange={(e) => handleNumberChange('smtp_port', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Username</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={settings.smtp_user}
                                    onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Password</label>
                                <input
                                    type="password"
                                    className="input"
                                    value={settings.smtp_pass}
                                    onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">From Email</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={settings.smtp_from}
                                    onChange={(e) => setSettings({ ...settings, smtp_from: e.target.value })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-md text-sm">
                                <p className="font-semibold mb-1">Why use Gmail API?</p>
                                <p>This method uses HTTPS (Port 443) which bypasses hosting provider blocks on Ports 587/465.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Gmail Address (Sender)</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={settings.gmail_user || ''}
                                    onChange={(e) => setSettings({ ...settings, gmail_user: e.target.value })}
                                    placeholder="library@gmail.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Client ID</label>
                                <input
                                    type="text"
                                    className="input font-mono text-xs"
                                    value={settings.gmail_client_id || ''}
                                    onChange={(e) => setSettings({ ...settings, gmail_client_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Client Secret</label>
                                <input
                                    type="password"
                                    className="input font-mono text-xs"
                                    value={settings.gmail_client_secret || ''}
                                    onChange={(e) => setSettings({ ...settings, gmail_client_secret: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Refresh Token</label>
                                <input
                                    type="password"
                                    className="input font-mono text-xs"
                                    value={settings.gmail_refresh_token || ''}
                                    onChange={(e) => setSettings({ ...settings, gmail_refresh_token: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Test Email Section */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                            Test Connection
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Enter recipient email (e.g. your@email.com)"
                                className="input flex-1"
                                id="test-email-to"
                            />
                            <button
                                type="button"
                                onClick={async () => {
                                    const toEmail = (document.getElementById('test-email-to') as HTMLInputElement).value;
                                    if (!toEmail) return alert('Please enter a recipient email');

                                    const btn = document.getElementById('test-email-btn') as HTMLButtonElement;
                                    const originalText = btn.innerText;
                                    btn.innerText = 'Sending...';
                                    btn.disabled = true;

                                    try {
                                        await api.post('/settings/test-email', {
                                            ...settings,
                                            to_email: toEmail
                                        });
                                        alert('Test email sent successfully! Check your inbox.');
                                    } catch (error: any) {
                                        console.error(error);
                                        const errMsg = error.response?.data?.message || 'Failed to send test email';
                                        const errDetail = error.response?.data?.error ? `\nDetails: ${error.response.data.error}` : '';
                                        alert(errMsg + errDetail);
                                    } finally {
                                        btn.innerText = originalText;
                                        btn.disabled = false;
                                    }
                                }}
                                id="test-email-btn"
                                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all shadow-md shadow-blue-100 flex items-center gap-2 whitespace-nowrap"
                            >
                                <Mail size={18} />
                                Send Test Email
                            </button>
                        </div>
                    </div>
                </div>

                {/* Email Templates */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-4 text-green-700">
                        <Mail size={20} />
                        <h2 className="text-lg font-semibold">Email Templates</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 border-b pb-1 mb-3">Overdue Warning Email</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Subject</label>
                                    <input
                                        ref={subjectInputRef}
                                        type="text"
                                        className={`input ${activeField === 'subject' ? 'ring-2 ring-blue-500 border-blue-500' : ''} `}
                                        placeholder="Book Due: {book}"
                                        value={(settings.email_templates as any)?.overdue?.subject || ''}
                                        onFocus={() => setActiveField('subject')}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            email_templates: {
                                                ...(settings.email_templates as any || {}),
                                                overdue: { ...(settings.email_templates as any)?.overdue, subject: e.target.value }
                                            }
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Body</label>
                                    {/* HTML Tools */}
                                    <div className="flex flex-wrap gap-1 mb-2 justify-end">
                                        {[
                                            { label: 'H1', value: '<h1 style="color:#111827; margin-bottom:10px;">Header 1</h1>', title: 'Large Header' },
                                            { label: 'H2', value: '<h2 style="color:#374151; margin-bottom:8px;">Header 2</h2>', title: 'Medium Header' },
                                            { label: 'B', value: '<b>Bold</b>', title: 'Bold' },
                                            { label: 'I', value: '<i>Italic</i>', title: 'Italic' },
                                            { label: 'U', value: '<u>Underline</u>', title: 'Underline' },
                                            { label: 'BR', value: '<br/>', title: 'Line Break' },
                                            { label: 'HR', value: '<hr style="border:0; border-top:1px solid #e5e7eb; margin:15px 0;"/>', title: 'Horizontal Line' },
                                            { label: 'P', value: '<p style="margin-bottom:10px;">Paragraph</p>', title: 'Paragraph' },
                                            { label: 'DIV', value: '<div style="padding:10px;">Div Container</div>', title: 'Div Container' },
                                            { label: 'Center', value: '<div style="text-align:center;">Centered Text</div>', title: 'Center Align' },
                                            { label: 'IMG', value: '<img src="https://via.placeholder.com/300" alt="Image" style="max-width:100%; border-radius:5px;" />', title: 'Image' },
                                            { label: 'UL', value: '<ul style="padding-left:20px;">\n  <li>List Item 1</li>\n  <li>List Item 2</li>\n</ul>', title: 'Unordered List' },
                                            { label: 'LI', value: '<li>List Item</li>', title: 'List Item' },
                                            { label: 'Button', value: '<a href="#" style="display:inline-block; background-color:#2563eb; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">Action Button</a>', title: 'Call to Action Button' },
                                            { label: 'Box', value: '<div style="background-color:#f3f4f6; padding:15px; border-radius:8px; border:1px solid #e5e7eb;">Highlighted Box Content</div>', title: 'Gray Highlight Box' },
                                        ].map((tag) => (
                                            <button
                                                key={tag.label}
                                                type="button"
                                                onClick={() => insertVariable(tag.value)}
                                                className="px-2 h-7 flex items-center justify-center bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-300 rounded text-[10px] font-bold text-gray-600 hover:text-blue-600 transition-all shadow-sm"
                                                title={tag.title}
                                            >
                                                {tag.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <textarea
                                            ref={bodyInputRef}
                                            className={`input h-[300px] font-mono text-sm leading-relaxed ${activeField === 'body' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                            value={(settings.email_templates as any)?.overdue?.body || ''}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                email_templates: {
                                                    ...(settings.email_templates as any || {}),
                                                    overdue: { ...(settings.email_templates as any)?.overdue, body: e.target.value }
                                                }
                                            })}
                                            onFocus={() => setActiveField('body')}
                                            placeholder="Write your email body here. Use variables like {user}, {book}..."
                                        />
                                        <div className="mt-2 text-right">
                                            <p className="text-xs text-gray-500 mb-2">Available Variables (Click to insert):</p>
                                            <div className="flex flex-wrap gap-2 justify-end">
                                                {availableVariables.map((v) => (
                                                    <button
                                                        key={v.value}
                                                        type="button"
                                                        onClick={() => insertVariable(v.value)}
                                                        className="px-2 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent rounded text-xs font-medium transition-colors cursor-pointer"
                                                        title={`Insert ${v.label} `}
                                                    >
                                                        {v.value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Automation Settings */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-4 text-blue-700">
                        <Bell size={20} />
                        <h2 className="text-lg font-semibold">Automation Rules</h2>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Loan Duration (Days)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="input md:w-1/3"
                            value={settings.overdue_days}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d+$/.test(val)) {
                                    handleNumberChange('overdue_days', val === '' ? '0' : val);
                                }
                            }}
                        />
                        <p className="text-xs text-gray-500 mt-1">Books are considered overdue after this many days.</p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Save size={18} />
                        {isLoading ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};
