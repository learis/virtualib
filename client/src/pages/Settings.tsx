import { useState, useEffect, useRef } from 'react';
import { Save, Mail, Bell } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

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
    const quillRef = useRef<any>(null);

    const insertVariable = (variable: string) => {
        if (!activeField) return;

        const currentTemplates = (settings.email_templates as any) || {};
        const overdue = currentTemplates.overdue || {};

        if (activeField === 'subject') {
            const currentVal = overdue.subject || '';
            const input = subjectInputRef.current;
            let newValue = '';
            let newCursorPos = 0;

            if (input) {
                const start = input.selectionStart || currentVal.length;
                const end = input.selectionEnd || currentVal.length;
                newValue = currentVal.substring(0, start) + variable + currentVal.substring(end);
                newCursorPos = start + variable.length;
            } else {
                newValue = currentVal + variable;
            }

            setSettings({
                ...settings,
                email_templates: {
                    ...currentTemplates,
                    overdue: { ...overdue, subject: newValue }
                }
            });
            setTimeout(() => {
                const el = subjectInputRef.current;
                if (el) {
                    el.focus();
                    el.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        } else {
            // Body - Quill Editor Insertion
            const quill = quillRef.current?.getEditor();
            if (quill) {
                const range = quill.getSelection(true); // true = focus if not focused
                if (range) {
                    quill.insertText(range.index, variable);
                    // No need to manually update state here, Quill's onChange handles it
                }
            }
        }
    };

    // ... (skipping to onChange)

    <ReactQuill
        ref={quillRef}
        theme="snow"
        className="h-full"
        value={(settings.email_templates as any)?.overdue?.body || ''}
        onChange={(value: string) => setSettings({
            ...settings,
            email_templates: {
                ...(settings.email_templates as any || {}),
                overdue: { ...(settings.email_templates as any)?.overdue, body: value }
            }
        })}
        onFocus={() => setActiveField('body')}
        modules={{
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link'],
                ['clean']
            ],
        }}
    />
                                        </div >
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
                                    </div >
                                </div >
                            </div >
                        </div >
                    </div >
                </div >

    {/* Automation Settings */ }
    < div className = "bg-white p-6 rounded-lg shadow-sm border border-gray-200" >
                    <div className="flex items-center gap-2 mb-4 text-blue-700">
                        <Bell size={20} />
                        <h2 className="text-lg font-semibold">Automation Rules</h2>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Loan Duration (Days)</label>
                        <input
                            type="number"
                            className="input md:w-1/3"
                            value={settings.overdue_days}
                            onChange={(e) => handleNumberChange('overdue_days', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">Books are considered overdue after this many days.</p>
                    </div>
                </div >

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
            </form >
        </div >
    );
};
